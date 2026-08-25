#!/usr/bin/env node
/**
 * JAILBREAK: CAMERA — stage art generator
 *
 *   node tools/generate-art.js              # generate anything missing
 *   node tools/generate-art.js --force      # redo everything
 *   node tools/generate-art.js 3 5          # redo just stages 3 and 5
 *
 * The game is linear, so the seven dioramas never change. There is no reason to
 * pay for and wait on image generation at runtime: this writes them once as
 * assets/stage-N.png, they get committed, and every play after that loads a
 * static file. Live per-playthrough generation — jailbreak's model — is the
 * eventual upgrade, not the MVP.
 *
 * Character consistency comes from a reference image, exactly as in jailbreak.
 * Drop the punk into assets/reference.png (cell.png from the jailbreak repo is
 * the obvious one) and every stage is generated against it. With no reference
 * present, stage 1 is generated cold and then becomes the reference for the
 * other six, so the character still holds together across the run.
 */

const fs = require('node:fs');
const path = require('node:path');

const { STAGES, CHARACTER_SHEET, GUARD_SHEET, ART_STYLE } = require('../stages.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

for (const line of readIfExists(path.join(ROOT, '.env')).split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const API_KEY = process.env.GEMINI_API_KEY || '';

// Same ladder as jailbreak: the newest image model this key can see wins.
const IMAGE_MODELS = [
  'gemini-3.1-flash-image',   // Nano Banana 2
  'gemini-3-pro-image',       // Nano Banana Pro
  'gemini-2.5-flash-image',   // Nano Banana (legacy)
  'gemini-2.0-flash-preview-image-generation',
];
let MODEL = IMAGE_MODELS[IMAGE_MODELS.length - 1];

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
        signal: AbortSignal.timeout(120000),   // image generation is slow
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

/**
 * The accepted generationConfig differs between image model generations, so
 * walk down a ladder of request shapes rather than 400ing on the first one.
 * Carried over from jailbreak's makeImage.
 */
async function makeImage({ prompt, referenceB64, referenceMime = 'image/png' }) {
  const parts = [{ text: prompt }];
  if (referenceB64) parts.push({ inlineData: { mimeType: referenceMime, data: referenceB64 } });

  const configs = [
    { responseModalities: ['TEXT', 'IMAGE'], responseFormat: { image: { aspectRatio: '1:1' } } },
    { responseModalities: ['TEXT', 'IMAGE'] },
    { responseModalities: ['IMAGE'] },
    {},
  ];

  let lastErr;
  for (const generationConfig of configs) {
    try {
      const data = await gemini(MODEL, { contents: [{ role: 'user', parts }], generationConfig }, { tries: 2 });
      const found = (data?.candidates?.[0]?.content?.parts || [])
        .find(p => p.inlineData?.data || p.inline_data?.data);
      const inline = found?.inlineData || found?.inline_data;
      if (inline?.data) return { b64: inline.data, mime: inline.mimeType || inline.mime_type || 'image/png' };
      lastErr = new Error(`${MODEL} returned no image part (${data?.candidates?.[0]?.finishReason || 'unknown'})`);
    } catch (e) {
      lastErr = e;
      if (!/400|invalid|unknown name|not supported/i.test(e.message)) break;
    }
  }
  throw lastErr;
}

/**
 * Stage 1 is the punk on his own. Every stage after it also carries the guard, so
 * his sheet only goes in the prompt when he is actually in the picture — sending
 * it for stage 1 invites the model to add a guard who should not be there.
 */
function buildPrompt(stage) {
  let out = `${ART_STYLE}\n\nSCENE: ${stage.art}\n\nCHARACTER: ${CHARACTER_SHEET}`;
  if (stage.guard) out += `\n\nSECOND CHARACTER: ${GUARD_SHEET}`;
  return out;
}

async function resolveModel() {
  try {
    const res = await fetch(`${API_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': API_KEY } });
    if (!res.ok) throw new Error(`${res.status}`);
    const names = ((await res.json()).models || []).map(m => m.name.replace(/^models\//, ''));
    MODEL = IMAGE_MODELS.find(m => names.includes(m)) || MODEL;
  } catch { /* stick with the bottom of the ladder */ }
}

(async () => {
  if (!API_KEY) {
    console.error('\n  No GEMINI_API_KEY found. Put it in .env first.\n');
    process.exit(1);
  }
  fs.mkdirSync(ASSETS, { recursive: true });
  await resolveModel();

  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const only = args.filter(a => /^\d+$/.test(a)).map(Number);

  // A hand-supplied reference wins. Otherwise stage 1, once it exists, is the
  // reference for everything after it.
  let ref = null;
  const refPath = ['reference.png', 'reference.jpg', 'cell.png']
    .map(f => path.join(ASSETS, f)).find(p => fs.existsSync(p));
  if (refPath) {
    ref = { b64: fs.readFileSync(refPath).toString('base64'), mime: refPath.endsWith('.jpg') ? 'image/jpeg' : 'image/png' };
    console.log(`\n  reference: ${path.basename(refPath)}`);
  } else {
    console.log('\n  reference: none — stage 1 will seed the rest');
  }
  console.log(`  model    : ${MODEL}\n`);

  for (let i = 0; i < STAGES.length; i++) {
    const n = i + 1;
    const out = path.join(ASSETS, `stage-${n}.png`);
    const want = only.length ? only.includes(n) : true;

    if (!want) continue;
    if (fs.existsSync(out) && !force && !only.includes(n)) {
      if (!ref) ref = { b64: fs.readFileSync(out).toString('base64'), mime: 'image/png' };
      console.log(`  ${n}. ${STAGES[i].scene} — already there, skipping`);
      continue;
    }

    process.stdout.write(`  ${n}. ${STAGES[i].scene} ... `);
    const t0 = Date.now();
    try {
      const img = await makeImage({
        prompt: buildPrompt(STAGES[i]),
        referenceB64: ref && ref.b64,
        referenceMime: ref && ref.mime,
      });
      fs.writeFileSync(out, Buffer.from(img.b64, 'base64'));
      console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s → assets/stage-${n}.png`);
      // First one generated becomes the anchor for the rest of the run.
      if (!ref) ref = { b64: img.b64, mime: img.mime };
    } catch (e) {
      console.log(`\x1b[31mfailed\x1b[0m — ${e.message}`);
    }
  }

  const done = STAGES.filter((_, i) => fs.existsSync(path.join(ASSETS, `stage-${i + 1}.png`))).length;
  console.log(`\n  ${done}/${STAGES.length} stages have art.`);
  console.log('  Look at them before committing — a character that has drifted off-model is worth regenerating.\n');
})();

function readIfExists(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
