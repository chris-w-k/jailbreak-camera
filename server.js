#!/usr/bin/env node
/**
 * JAILBREAK: CAMERA — dev server + Gemini vision proxy
 *
 * Zero dependencies. Node 18+ (tested on 22).
 *
 *   node server.js            # real Gemini calls
 *   MOCK=1 node server.js     # canned verdicts, no network, no cost
 *   PORT=3000 node server.js
 *
 * The API key lives here, never in the browser. Transport, structured-output
 * and abuse-guard code is carried over from chris-w-k/jailbreak with the text
 * call swapped for a vision one.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { STAGES, TOTAL_STAGES, ATTEMPTS_PER_STAGE } = require('./stages.js');

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
const MOCK = process.env.MOCK === '1';

// .env loader (KEY=value, # comments)
for (const line of readIfExists(path.join(ROOT, '.env')).split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

// Trimmed deliberately: a key pasted into a hosting dashboard very often
// arrives with a trailing space or newline, and Google rejects that as
// API_KEY_INVALID with nothing to suggest whitespace is the problem.
const API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// --- analytics (optional; unset = the client sends nothing) ---
const POSTHOG_KEY = process.env.POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';

// --- localisation ---
// Interface chrome is translated in public/i18n.js. Everything the punk says —
// the asks and the judge's one-line reactions — stays English, because an
// English speechSynthesis voice reads it aloud. Same rule as jailbreak.
const LANGS = { en: 'English', es: 'Spanish', pt: 'Portuguese', tr: 'Turkish' };
function normLang(l) {
  const k = String(l || '').slice(0, 5).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LANGS, k) ? k : 'en';
}

// --- abuse guards (all optional; unset = off, which is what you want locally) ---
const ACCESS_CODE = process.env.ACCESS_CODE || '';               // '' = no gate
// Set either of these to 0 to turn that limit off. Worth having: when the game
// is opened as a webview inside the app, every player on a mobile network can
// arrive from the same carrier NAT address, and a per-IP cap then locks real
// users out of each other's quota. 0 is off rather than "no runs allowed",
// because the other reading is a very easy way to take the game down.
const RUNS_PER_IP_PER_HOUR = Number(process.env.RUNS_PER_IP_PER_HOUR || 5);
const RUNS_PER_DAY = Number(process.env.RUNS_PER_DAY || 250);    // global backstop on the bill
// A run is 7 stages x 3 attempts = 21 photos at worst. This is the per-session
// ceiling that stops a stuck (or scripted) player looping /api/judge forever.
const PHOTOS_PER_RUN = Number(process.env.PHOTOS_PER_RUN || 40);
// The shot clock. The server owns the number so it can be tuned without a client
// edit; the client counts down and reports the expiry, because only the client
// knows when the viewfinder actually opened.
const SHOT_SECONDS = Number(process.env.SHOT_SECONDS || 15);
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 700 * 1024);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Preference ladder — the server probes ListModels on boot and takes the first
// one this key can actually see, so a model being renamed or retired degrades
// instead of 400ing. All of these are multimodal; the judge sends an image.
const VISION_MODELS = [
  'gemini-flash-latest',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
];
let MODELS = { vision: VISION_MODELS[0], resolved: false, note: '' };
// Set when Google tells us the key itself is no good. Worth its own flag: the
// server still boots and still serves the page, but every judgement will fail,
// so this is the one condition where the logs need to say what to go and fix.
let KEY_REJECTED = false;

// ---------------------------------------------------------------------------
// the judge
// ---------------------------------------------------------------------------

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    object: { type: 'string', description: 'The single most prominent object being shown, named plainly and specifically. Two or three words.' },
    verdict: { type: 'string', enum: ['pass', 'fail', 'unreadable'] },
    reason: { type: 'string', description: "One short line in the punk's voice, spoken out loud to the player. English always." },
    confidence: { type: 'number', description: 'How sure you are about what the OBJECT is, from 0 to 1. Not how sure you are of the verdict.' },
  },
  required: ['object', 'verdict', 'reason', 'confidence'],
};

/**
 * The rubric is per-stage data; the voice guide and the fairness rules are the
 * same every stage. Keeping them in one template means tuning the feel of the
 * whole game is a single edit rather than seven.
 */
/** The words this stage teaches, for the recast instruction below. */
function listWords(stage) {
  const w = (stage.vocab || []).map(v => `"${v.word}"`);
  if (!w.length) return 'the words the punk used';
  return w.length === 1 ? w[0] : `${w.slice(0, -1).join(', ')} or ${w[w.length - 1]}`;
}

function judgeSystem(stage) {
  return `You are the judge in a comedy prison-break video game. The player's character is a loud, cocky purple-haired punk teenager trying to break out of prison. He can't reach anything himself, so at each stage he asks the player to find a real object near them and hold it up. You decide whether what they found will do.

THIS STAGE
The punk asked for: "${stage.ask}"
What counts: ${stage.rubric}
Objects that must PASS: ${stage.accepts.join(', ')}.
Objects that must FAIL: ${stage.rejects.join(', ')}.

YOUR JOB
Identify the single most prominent object the player is showing you, then decide whether it satisfies the request.

RULES
- Judge generously. If a reasonable person would say "yeah, that could work", pass it. A near-miss accepted is charming; a plausible object rejected feels like a bug.
- Judge only the object being presented. Ignore the room behind it, the hand holding it, and any clutter.
- Use verdict "unreadable" when you cannot honestly name what you are looking at: too dark, too blurry, too close, motion-smeared, empty, or a photograph of a screen showing a picture of an object rather than a real object. This is not a failure and costs the player nothing, so reach for it rather than guessing.
- If you are less than about half sure what the object is, that is "unreadable", not "fail".
- Set confidence for the OBJECT identification, not for the verdict.

THE VOICE
"reason" is the punk speaking out loud, and the player reads it exactly as you wrote it. One line, twelve words at most, present tense, cocky and daft. Delighted when it works, withering about the object when it doesn't — never rude about the player.
This is an English-learning game, so when you PASS a photo, name the object and work ${listWords(stage)} back into the line — hearing the word again, about the thing they just went and found, is how it sticks. Never force it to the point of sounding odd.
Passes sound like: "A biro! Get in." / "Perfect. This lock's got no idea."
Fails sound like: "That's a mug, mate. I said pointy." / "Can't pick a lock with a banana."
Unreadable sounds like: "It's pitch black, I can't see a thing!" / "Whoa, too close — back up a bit."
He believes the player is passing him objects through the bars. Never mention photos, cameras, phones, AI, or judging. Always write it in English.`;
}

// ---------------------------------------------------------------------------
// Gemini transport
// ---------------------------------------------------------------------------

async function gemini(model, body, { tries = 3 } = {}) {
  const url = `${API_BASE}/models/${model}:generateContent`;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt) await sleep(700 * 2 ** attempt);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(20000),
      });
    } catch (e) {
      lastErr = new Error(`network: ${e.message}`);
      continue;
    }
    const text = await res.text();
    if (res.ok) {
      try { return JSON.parse(text); }
      catch { throw new Error(`Gemini returned non-JSON: ${text.slice(0, 300)}`); }
    }
    lastErr = new Error(`Gemini ${res.status} on ${model}: ${text.slice(0, 400)}`);
    // 400s are our fault and won't fix themselves; 429/5xx are worth a retry.
    if (res.status !== 429 && res.status < 500) break;
  }
  throw lastErr;
}

/** Structured JSON call. parts = array of Gemini parts (text and/or inlineData). */
async function askJSON({ system, parts, schema, temperature = 0.7 }) {
  const data = await gemini(MODELS.vision, {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema,
      temperature,
    },
  });
  const txt = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!txt.trim()) {
    const reason = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || 'empty response';
    throw new Error(`No text back from ${MODELS.vision} (${reason})`);
  }
  return parseLooseJSON(txt);
}

// ---------------------------------------------------------------------------
// mock judge — coin flip after a plausible delay, so the whole flow is
// playable with no key, no network and no cost.
// ---------------------------------------------------------------------------

const MOCK_PASS = ['A biro! Get in.', "Perfect. That'll do nicely.", 'Yes! Knew you had it in you.'];
const MOCK_FAIL = ["That's not it, mate. Look again.", 'Useless. Next.', "Nope. Try harder."];
const MOCK_DARK = ["It's pitch black, I can't see a thing!", 'Whoa, too close — back up a bit.'];

// Running out of time needs no model call — the punk isn't reacting to an object,
// he's reacting to nothing arriving. Fixed lines, free, instant.
const TIMEOUT_LINES = [
  "Too slow! He's right on me!",
  'What were you DOING? He nearly had me!',
  "Time's up and so am I, come on!",
  'Any slower and I\'d be back in that cell!',
];

async function mockJudge(stage, seq, force) {
  await sleep(900 + (seq % 3) * 400);
  // ?verdict=fail in the client forces the outcome, so the caught screen and the
  // free-retry path can be exercised on demand. The natural cycle below never
  // produces three fails in a row, which means it can't reach a loss by itself.
  if (force === 'pass') return { object: 'a ballpoint pen', verdict: 'pass', reason: pick(MOCK_PASS, seq), confidence: 0.95 };
  if (force === 'fail') return { object: 'a mug', verdict: 'fail', reason: pick(MOCK_FAIL, seq), confidence: 0.95 };
  if (force === 'unreadable') return { object: 'something blurry', verdict: 'unreadable', reason: pick(MOCK_DARK, seq), confidence: 0.15 };
  const roll = seq % 5;
  if (roll === 4) return { object: 'something blurry', verdict: 'unreadable', reason: pick(MOCK_DARK, seq), confidence: 0.2 };
  if (roll < 2) return { object: 'a ballpoint pen', verdict: 'pass', reason: pick(MOCK_PASS, seq), confidence: 0.9 };
  return { object: 'a mug', verdict: 'fail', reason: pick(MOCK_FAIL, seq), confidence: 0.9 };
}
const pick = (arr, n) => arr[Math.abs(n) % arr.length];

// ---------------------------------------------------------------------------
// sessions — in memory, reaped on a TTL. A prototype, not a database.
// ---------------------------------------------------------------------------

const sessions = new Map();
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 60 * 60 * 1000);
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 200);

function reapSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.touched > SESSION_TTL_MS) sessions.delete(id);
  // Hard ceiling as well as a TTL: a burst of abandoned runs shouldn't be able
  // to grow this map without bound between reaps.
  if (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((a, b) => a[1].touched - b[1].touched);
    for (const [id] of oldest.slice(0, sessions.size - MAX_SESSIONS)) sessions.delete(id);
  }
}
setInterval(reapSessions, 5 * 60 * 1000).unref();

function newSession(lang) {
  reapSessions();
  const id = crypto.randomUUID();
  const s = {
    id,
    lang: normLang(lang),
    stage: 0,
    attemptsLeft: ATTEMPTS_PER_STAGE,
    photos: 0,
    // Every object the judge managed to identify, in order. Powers the
    // end-of-run contact sheet, and it's the hook for reactive art later.
    evidence: [],
    startedAt: Date.now(),
    touched: Date.now(),
    over: null,          // null | 'caught' | 'escaped'
  };
  sessions.set(id, s);
  return s;
}

function getSession(id) {
  const s = sessions.get(String(id || ''));
  if (!s) throw Object.assign(new Error('That run has expired. Start a new one.'), { status: 410 });
  s.touched = Date.now();
  return s;
}

/**
 * Stage art is optional — `npm run art` writes it and it gets committed. The
 * path is only handed to the client when the file is actually there, so a
 * missing diorama becomes a deliberate placeholder rather than a 404 in the
 * console. Cached, because this runs on every state change.
 */
const artCache = new Map();
function assetPath(name) {
  if (!artCache.has(name)) {
    artCache.set(name, fs.existsSync(path.join(ROOT, 'assets', `${name}.png`)) ? `/assets/${name}.png` : null);
  }
  return artCache.get(name);
}
function artPath(index) { return assetPath(`stage-${index + 1}`); }

/**
 * The two opening stills, under the same rule as the stage dioramas: named only
 * when the file is there, so the client shows a holding frame instead of asking
 * for something that does not exist. Resolved once at boot rather than per
 * request — they cannot appear while the process is running.
 */
const INTRO_ART = ['intro-1', 'intro-2'].map(assetPath);

/**
 * The two words this stage is teaching, plus the whole line, in the language the
 * run was started in. Only that one language is sent: the client cannot switch
 * mid-run, and there is no reason to ship four translations to every player.
 *
 * An English run gets the words but no glosses — bolding them still helps the
 * reader notice the form, and there is nothing to translate them into.
 */
function vocabFor(stage, lang) {
  const words = stage.vocab || [];
  const local = lang && lang !== 'en';
  return {
    vocab: words.map(v => ({ word: v.word, local: local ? (v[lang] || null) : null })),
    askLocal: local ? ((stage.askLocal || {})[lang] || null) : null,
  };
}

/** What the client is allowed to know about the current position. */
function statePayload(s) {
  const stage = STAGES[s.stage];
  return {
    sessionId: s.id,
    stageIndex: s.stage,
    stageNumber: s.stage + 1,
    totalStages: TOTAL_STAGES,
    attemptsLeft: s.attemptsLeft,
    attemptsPerStage: ATTEMPTS_PER_STAGE,
    shotSeconds: SHOT_SECONDS,
    over: s.over,
    stage: stage && !s.over ? {
      id: stage.id, scene: stage.scene, ask: stage.ask, art: artPath(s.stage),
      ...vocabFor(stage, s.lang),
    } : null,
    intro: INTRO_ART,
    evidence: s.evidence,
  };
}

// ---------------------------------------------------------------------------
// the judge endpoint
// ---------------------------------------------------------------------------

async function judgePhoto(sessionId, imageB64, mime, force) {
  const s = getSession(sessionId);
  if (s.over) throw Object.assign(new Error('That run is already over.'), { status: 409 });

  const b64 = String(imageB64 || '').replace(/^data:[^,]+,/, '');
  if (!b64) throw Object.assign(new Error('No photo received.'), { status: 400 });
  // base64 is 4 chars per 3 bytes; check the decoded size against the cap.
  if (Math.floor(b64.length * 3 / 4) > MAX_IMAGE_BYTES) {
    throw Object.assign(new Error('That photo is too big. Try again.'), { status: 413 });
  }
  if (++s.photos > PHOTOS_PER_RUN) {
    throw Object.assign(new Error("That's enough photos for one run. Start a new one."), { status: 429 });
  }

  const stage = STAGES[s.stage];
  const t0 = Date.now();

  let out;
  try {
    out = MOCK
      ? await mockJudge(stage, s.photos, MOCK ? force : null)
      : await askJSON({
          system: judgeSystem(stage),
          parts: [
            { text: 'Here is what the player is holding up. Judge it.' },
            { inlineData: { mimeType: mime === 'image/png' ? 'image/png' : 'image/jpeg', data: b64 } },
          ],
          schema: JUDGE_SCHEMA,
        });
  } catch (e) {
    // The model being unavailable must never cost an attempt. A flaky phone
    // connection ending a run would feel like the game cheating.
    console.error('\x1b[31m✖\x1b[0m judge failed:', e.message);
    return {
      ...statePayload(s),
      verdict: 'error',
      object: null,
      reason: "The light's gone funny — try that again.",
      latencyMs: Date.now() - t0,
    };
  }

  let verdict = ['pass', 'fail', 'unreadable'].includes(out.verdict) ? out.verdict : 'unreadable';
  const confidence = Number(out.confidence);
  // Low confidence is an unreadable photo, not a wrong object. Guessing at a
  // blurry shape and calling it a failure is the one thing that would make this
  // feel unfair, so the rule is enforced here as well as asked for in the prompt.
  if (verdict === 'fail' && Number.isFinite(confidence) && confidence < 0.5) verdict = 'unreadable';

  if (verdict === 'pass') {
    s.evidence.push({
      stage: stage.id, scene: stage.scene,
      object: String(out.object || '').slice(0, 60),
      // Carried so the ending can show the words this object satisfied.
      words: (stage.vocab || []).map(v => v.word).join(' · '),
    });
    s.stage += 1;
    s.attemptsLeft = ATTEMPTS_PER_STAGE;
    if (s.stage >= TOTAL_STAGES) s.over = 'escaped';
  } else if (verdict === 'fail') {
    s.attemptsLeft -= 1;
    if (s.attemptsLeft <= 0) s.over = 'caught';
  }
  // 'unreadable' changes nothing at all — free retry.

  return {
    ...statePayload(s),
    verdict,
    object: String(out.object || '').slice(0, 60) || null,
    reason: String(out.reason || '').slice(0, 240),
    confidence: Number.isFinite(confidence) ? confidence : null,
    latencyMs: Date.now() - t0,
    // Only meaningful on 'escaped', but harmless otherwise.
    durationMs: Date.now() - s.startedAt,
  };
}

/**
 * The shot clock ran out. Costs an attempt, exactly as a wrong object does —
 * one currency, so the tally marks stay the only thing the player has to watch.
 *
 * Note this is reported by the client rather than enforced from a server-side
 * deadline. Deliberate for a prototype: there is nothing to win, so the only
 * person a tamperer could give more time to is themselves. If this ever becomes
 * something people compete at, stamp the stage-open time on the session and
 * reject a late photo here instead.
 */
function timeUp(sessionId) {
  const s = getSession(sessionId);
  if (s.over) throw Object.assign(new Error('That run is already over.'), { status: 409 });

  s.attemptsLeft -= 1;
  if (s.attemptsLeft <= 0) s.over = 'caught';

  return {
    ...statePayload(s),
    verdict: 'timeout',
    object: null,
    reason: TIMEOUT_LINES[(ATTEMPTS_PER_STAGE - s.attemptsLeft - 1 + s.photos) % TIMEOUT_LINES.length],
    durationMs: Date.now() - s.startedAt,
  };
}

// ---------------------------------------------------------------------------
// access gate + rate limiting
//
// A public URL is a public spend button on the Gemini key, and photo judging
// costs more per play than jailbreak's text turns. Three layers:
//   1. an access code, so randoms can't play at all
//   2. a per-IP hourly cap on runs
//   3. a global daily cap, which is the one that actually protects the bill
// Plus PHOTOS_PER_RUN above, which bounds a single session.
// All env-configured and all off by default, so local dev is unchanged.
// ---------------------------------------------------------------------------

function mintToken() {
  const exp = Date.now() + TOKEN_TTL_MS;
  return `${exp}.${crypto.createHmac('sha256', ACCESS_CODE).update(String(exp)).digest('hex').slice(0, 32)}`;
}
function tokenValid(tok) {
  if (!tok) return false;
  const [exp, sig] = String(tok).split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = crypto.createHmac('sha256', ACCESS_CODE).update(exp).digest('hex').slice(0, 32);
  return sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}

function unlocked(req) {
  if (!ACCESS_CODE) return true;
  const cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map(c => {
      const i = c.indexOf('=');
      return i === -1 ? [c.trim(), ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
    }).filter(([k]) => k)
  );
  return tokenValid(cookies.jbc_auth);
}

function clientIP(req) {
  const xff = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket.remoteAddress || 'unknown';
}

const ipHits = new Map();
let dayStamps = [];

function checkRate(req) {
  const now = Date.now();
  dayStamps = dayStamps.filter(t => now - t < 864e5);
  if (RUNS_PER_DAY > 0 && dayStamps.length >= RUNS_PER_DAY) {
    throw Object.assign(new Error('This demo has hit its daily limit. Try again tomorrow.'), { status: 429 });
  }
  const ip = clientIP(req);
  const hits = (ipHits.get(ip) || []).filter(t => now - t < 36e5);
  if (RUNS_PER_IP_PER_HOUR > 0 && hits.length >= RUNS_PER_IP_PER_HOUR) {
    throw Object.assign(new Error(`You've played ${RUNS_PER_IP_PER_HOUR} runs this hour — that's the limit. Come back later.`), { status: 429 });
  }
  hits.push(now); ipHits.set(ip, hits); dayStamps.push(now);
  if (ipHits.size > 5000) ipHits.clear();
}

function requireUnlocked(req) {
  if (!unlocked(req)) throw Object.assign(new Error('Locked. Reload and enter the access code.'), { status: 401 });
}

// ---------------------------------------------------------------------------
// http
// ---------------------------------------------------------------------------

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#191919"/><g fill="#8b5cf6"><rect x="2" y="4" width="12" height="9"/><rect x="6" y="2" width="4" height="2"/></g><circle cx="8" cy="8.5" r="2.5" fill="#191919"/><circle cx="8" cy="8.5" r="1.2" fill="#c4a6ff"/></svg>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, 'text/html; charset=utf-8', readIfExists(path.join(ROOT, 'public', 'index.html')));
    }
    if (req.method === 'GET' && url.pathname === '/i18n.js') {
      return send(res, 200, 'application/javascript; charset=utf-8', readIfExists(path.join(ROOT, 'public', 'i18n.js')));
    }
    if (req.method === 'GET' && url.pathname === '/favicon.ico') {
      return send(res, 200, 'image/svg+xml', FAVICON);
    }
    // Stage art. Explicitly numbered rather than a general static handler, so
    // there is nothing to get wrong about path traversal. A missing file 404s
    // and the client falls back to its placeholder panel.
    const art = /^\/assets\/(stage-[1-9][0-9]?|intro-[12])\.png$/.exec(url.pathname);
    if (req.method === 'GET' && art) {
      const buf = readBinIfExists(path.join(ROOT, 'assets', `${art[1]}.png`));
      if (!buf) return json(res, 404, { error: 'no art yet' });
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      return res.end(buf);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return json(res, 200, {
        ok: true, mock: MOCK, hasKey: !!API_KEY, keyRejected: KEY_REJECTED, models: MODELS,
        gated: !!ACCESS_CODE, unlocked: unlocked(req),
        sessions: sessions.size,
        stages: TOTAL_STAGES,
        attemptsPerStage: ATTEMPTS_PER_STAGE,
        shotSeconds: SHOT_SECONDS,
        langs: Object.keys(LANGS),
        posthog: POSTHOG_KEY ? { key: POSTHOG_KEY, host: POSTHOG_HOST } : null,
      });
    }
    if (req.method === 'POST' && url.pathname === '/api/unlock') {
      const { code } = await readBody(req);
      if (!ACCESS_CODE) return json(res, 200, { ok: true });
      const given = Buffer.from(String(code || ''));
      const want = Buffer.from(ACCESS_CODE);
      const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
      await sleep(400); // take the shine off brute-forcing
      if (!ok) return json(res, 401, { error: 'Wrong code.' });
      const secure = (req.headers['x-forwarded-proto'] || '').includes('https') ? '; Secure' : '';
      res.setHeader('Set-Cookie', `jbc_auth=${mintToken()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TOKEN_TTL_MS / 1000}${secure}`);
      return json(res, 200, { ok: true });
    }
    if (req.method === 'POST' && url.pathname === '/api/start') {
      requireUnlocked(req);
      checkRate(req);
      const body = await readBody(req);
      const s = newSession(body.lang);
      // ?stage=N in the client arrives as startAt, for testing stage 5 without
      // playing four stages first. Dev only — it is ignored once a gate is set.
      const at = Number(body.startAt);
      if (!ACCESS_CODE && Number.isInteger(at) && at > 0 && at <= TOTAL_STAGES) s.stage = at - 1;
      return json(res, 200, statePayload(s));
    }
    if (req.method === 'POST' && url.pathname === '/api/judge') {
      requireUnlocked(req);
      const body = await readBody(req);
      return json(res, 200, await judgePhoto(body.sessionId, body.image, body.mime, body.force));
    }
    if (req.method === 'POST' && url.pathname === '/api/timeout') {
      requireUnlocked(req);
      const body = await readBody(req);
      return json(res, 200, timeUp(body.sessionId));
    }
    if (req.method === 'POST' && url.pathname === '/api/abandon') {
      // Best-effort tidy-up when a player closes the tab, so the map doesn't
      // wait out a TTL on runs we know are finished.
      const body = await readBody(req);
      sessions.delete(String(body.sessionId || ''));
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error('\x1b[31m✖\x1b[0m', e.message);
    return json(res, e.status || 500, { error: e.message });
  }
});

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function resolveModels() {
  if (MOCK) { MODELS = { vision: 'mock', resolved: true, note: 'mock mode' }; return; }
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': API_KEY } });
    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      if (res.status === 400 && /API[_ ]key not valid|API_KEY_INVALID/i.test(body)) {
        KEY_REJECTED = true;
        throw new Error('Google rejected GEMINI_API_KEY');
      }
      throw new Error(`${res.status} ${body.slice(0, 200)}`);
    }
    const names = ((await res.json()).models || []).map(m => m.name.replace(/^models\//, ''));
    MODELS = {
      vision: VISION_MODELS.find(m => names.includes(m)) || VISION_MODELS[VISION_MODELS.length - 1],
      resolved: true,
      note: `${names.length} models visible to this key`,
    };
  } catch (e) {
    MODELS.note = `could not list models (${e.message}) — falling back to defaults`;
  }
}

(async () => {
  if (!API_KEY && !MOCK) {
    console.error('\n  No GEMINI_API_KEY found. Put it in .env, or run with MOCK=1 to play offline.\n');
    process.exit(1);
  }
  await resolveModels();
  const artCount = STAGES.filter((_, i) => artPath(i)).length;
  server.listen(PORT, () => {
    console.log(`\n  \x1b[35m▮▮\x1b[0m JAILBREAK: CAMERA\n`);
    console.log(`     http://localhost:${PORT}`);
    console.log(`     vision: ${MODELS.vision}`);
    if (MODELS.note) console.log(`     \x1b[90m${MODELS.note}\x1b[0m`);
    if (KEY_REJECTED) {
      console.log('');
      console.log(`     \x1b[31mGEMINI_API_KEY was rejected by Google. Every photo will fail.\x1b[0m`);
      console.log(`     \x1b[90mcheck: no trailing space in the value · key is from aistudio.google.com/apikey\x1b[0m`);
      console.log(`     \x1b[90m       Generative Language API enabled on that project · no IP/referrer restriction\x1b[0m`);
    }
    if (MOCK) console.log(`     \x1b[33mMOCK MODE — no API calls, no cost\x1b[0m`);
    console.log(`     stages: ${TOTAL_STAGES} · ${ATTEMPTS_PER_STAGE} attempts each · ${SHOT_SECONDS}s on the clock`);
    console.log(artCount === TOTAL_STAGES
      ? `     art   : all ${TOTAL_STAGES} present`
      : `     \x1b[90mart   : ${artCount}/${TOTAL_STAGES} — run \`npm run art\` to generate the rest\x1b[0m`);
    const introCount = INTRO_ART.filter(Boolean).length;
    console.log(introCount === 2
      ? `     intro : both stills present`
      : `     \x1b[90mintro : ${introCount}/2 — add assets/intro-1.png and intro-2.png\x1b[0m`);
    console.log(ACCESS_CODE
      ? `     gate  : ON — a code is required, so app users cannot play`
      : `     \x1b[90mgate  : off (set ACCESS_CODE to require one)\x1b[0m`);
    console.log(`     caps  : ${RUNS_PER_IP_PER_HOUR || 'off'} runs/ip/hr · ${RUNS_PER_DAY || 'off'}/day · ${PHOTOS_PER_RUN} photos/run`);
    console.log('');
    console.log(`     \x1b[90mthe camera needs https — use the Render URL or a tunnel to test on a phone\x1b[0m\n`);
  });
})();

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function readIfExists(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function readBinIfExists(p) { try { return fs.readFileSync(p); } catch { return null; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function send(res, code, type, body) { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); }
function json(res, code, obj) { send(res, code, 'application/json', JSON.stringify(obj)); }

/** Models occasionally wrap JSON in prose or a fence, even when asked not to. */
function parseLooseJSON(txt) {
  try { return JSON.parse(txt); } catch { /* fall through */ }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(txt);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch { /* fall through */ } }
  const first = txt.indexOf('{'), last = txt.lastIndexOf('}');
  if (first !== -1 && last > first) { try { return JSON.parse(txt.slice(first, last + 1)); } catch { /* fall through */ } }
  throw new Error(`Could not parse JSON from: ${txt.slice(0, 200)}`);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let d = '';
    // Photos arrive base64'd in the JSON body, so this cap has to clear
    // MAX_IMAGE_BYTES with room for the base64 overhead and the envelope.
    const limit = MAX_IMAGE_BYTES * 2 + 4096;
    req.on('data', c => { d += c; if (d.length > limit) reject(Object.assign(new Error('body too large'), { status: 413 })); });
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch { reject(Object.assign(new Error('bad JSON body'), { status: 400 })); } });
    req.on('error', reject);
  });
}
