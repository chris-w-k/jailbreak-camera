#!/usr/bin/env node
/**
 * JAILBREAK: CAMERA — voice generator
 *
 *   node tools/generate-voice.js                # generate anything missing
 *   node tools/generate-voice.js --force         # redo everything
 *   node tools/generate-voice.js stage-3 intro-1 # redo just those
 *
 * Everything the punk says outside of a judge response is a small, fixed set
 * of English lines — the seven stage asks and the two intro beats — so there
 * is no reason to pay for and wait on TTS at runtime, same logic as
 * generate-art.js. This writes them once as assets/voice/<name>.wav, they get
 * committed, and the client just plays the file.
 *
 * The per-photo verdict line can't be pre-baked this way — it doesn't exist
 * until a photo has been judged — so server.js synthesizes that one live, on
 * request, with synthesizeSpeech(). Same model, same voice, same style
 * instruction as here, so a pre-baked ask and a live reaction read as one
 * character rather than two.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { STAGES } = require('../stages.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'voice');
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

for (const line of readIfExists(path.join(ROOT, '.env')).split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_KEY = (process.env.GEMINI_API_KEY || '').trim();

// Kept identical to the constants in server.js on purpose — see the comment
// on TTS_STYLE there for why the "Say X:" phrasing matters.
const TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const TTS_VOICE = 'Zubenelgenubi';
const TTS_STYLE = 'Say in a cocky, gravelly, laddish teenage-punk voice, delighted when it works and withering about the object when it does not:';

async function gemini(model, body, { tries = 3 } = {}) {
  const url = `${API_BASE}/models/${model}:generateContent`;
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt) await sleep(900 * 2 ** attempt);
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) { lastErr = new Error(`network: ${e.message}`); continue; }
    const text = await res.text();
    if (res.ok) {
      try { return JSON.parse(text); }
      catch { throw new Error(`non-JSON back: ${text.slice(0, 300)}`); }
    }
    lastErr = new Error(`Gemini ${res.status} on ${model}: ${text.slice(0, 400)}`);
    if (res.status !== 429 && res.status < 500) break;
  }
  throw lastErr;
}

/** 16-bit PCM has no container of its own; a .wav file needs the 44-byte header. */
function pcmToWav(pcm, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);                       // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

async function synthesize(text) {
  const data = await gemini(TTS_MODEL, {
    contents: [{ parts: [{ text: `${TTS_STYLE} "${text}"` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  }, { tries: 3 });
  const part = (data?.candidates?.[0]?.content?.parts || []).find(p => p.inlineData?.data);
  if (!part) throw new Error(`${TTS_MODEL} returned no audio part (${data?.candidates?.[0]?.finishReason || 'unknown'})`);
  const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType || '')?.[1]) || 24000;
  return pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate);
}

/**
 * The intro beats live in public/i18n.js as `window.I18N.strings.en.intro_1/2`
 * (only in `en` — see that file's header comment on why). Running the real
 * file through a throwaway sandbox keeps this script from drifting out of
 * sync with a copy-pasted duplicate of the lines.
 */
function loadIntroLines() {
  const src = readIfExists(path.join(ROOT, 'public', 'i18n.js'));
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const en = sandbox.window.I18N.strings.en;
  return [en.intro_1, en.intro_2];
}

(async () => {
  if (!API_KEY) {
    console.error('\n  No GEMINI_API_KEY found. Put it in .env first.\n');
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });

  const [intro1, intro2] = loadIntroLines();
  const lines = [
    ...STAGES.map((st, i) => ({ name: `stage-${i + 1}`, text: st.ask, label: st.scene })),
    { name: 'intro-1', text: intro1, label: 'intro 1' },
    { name: 'intro-2', text: intro2, label: 'intro 2' },
  ];

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter(a => a !== '--force');

  console.log(`\n  model : ${TTS_MODEL}`);
  console.log(`  voice : ${TTS_VOICE}\n`);

  for (const line of lines) {
    const out = path.join(OUT, `${line.name}.wav`);
    const want = only.length ? only.includes(line.name) : true;
    if (!want) continue;

    if (fs.existsSync(out) && !force) {
      console.log(`  ${line.name.padEnd(9)} (${line.label}) — already there, skipping`);
      continue;
    }

    process.stdout.write(`  ${line.name.padEnd(9)} (${line.label}) ... `);
    const t0 = Date.now();
    try {
      const wav = await synthesize(line.text);
      fs.writeFileSync(out, wav);
      console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s → assets/voice/${line.name}.wav`);
    } catch (e) {
      console.log(`\x1b[31mfailed\x1b[0m — ${e.message}`);
    }
  }

  const done = lines.filter(l => fs.existsSync(path.join(OUT, `${l.name}.wav`))).length;
  console.log(`\n  ${done}/${lines.length} lines have voice.`);
  console.log('  Listen to them before committing — a line that reads flat or mispronounced is worth regenerating.\n');
})();

function readIfExists(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
