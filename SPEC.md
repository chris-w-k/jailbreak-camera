# Jailbreak: Camera — prototype spec
**v1.1 — stage-1 slice built; see README for how to run it**

A browser game where the player's real surroundings are the puzzle. Same punk
character, same isometric-diorama art style, same comedy tone as
[`chris-w-k/jailbreak`](https://github.com/chris-w-k/jailbreak) — but the mechanic
flips. Instead of picking one of four generated items, the player has to **find a
real object in the room they're sitting in and photograph it**. Gemini judges
whether it fits what the punk asked for. Three misses and the guard catches you.

---

## 1. Decisions

| | |
|---|---|
| **Stack** | Mirror jailbreak: plain Node `http` server, `public/index.html`, `render.yaml`, deployed on Render |
| **AI** | Same `GEMINI_API_KEY` system — one key, server-side only, `.env` gitignored, `sync: false` in the blueprint |
| **Judging** | Gemini vision + forced `responseSchema`, via the existing `askJSON()` pattern |
| **Stage art** | Pre-generated static PNGs for the MVP; live generation designed in as the eventual upgrade |
| **Reactive art** | Not in the slice. The identified object name is kept in game state and the hook is left in place |
| **First build** | Vertical slice, end to end. All seven stages are written as data, since the rubric shape was the same work seven times over; the tuning pass is still stage 1 only |
| **Restart rule** | Getting caught restarts the whole run |
| **Judge language** | `reason` is English always. No `reasonLocal` split for the MVP |
| **Extras kept** | Access code gate, PostHog, i18n (en/es/pt/tr), Web Speech read-aloud, WebAudio chiptune |

## 2. Core loop

```
STAGE BRIEF     punk speaks: "Yo — find me something sharp and pointy!"
      ↓
CAMERA          live rear camera, shutter button, 3 attempt pips
      ↓
CAPTURE         frame → canvas → downscaled JPEG (~768px, q0.7)
      ↓
JUDGING         2–4s "developing" beat while Gemini vision looks at it
      ↓
VERDICT
  PASS  → punk reacts in voice ("A biro! Nice.") → next stage
  FAIL  → attempts−1, in-character taunt, retry
  0 left → CAUGHT → restart run
```

One stage = one ask = one photo. No inventory, no free roam, no clock beyond the
attempt counter.

## 3. What carries over from jailbreak

Reused as close to verbatim as possible, so the two prototypes read as siblings.

| Asset | Source | Notes |
|---|---|---|
| `CHARACTER_SHEET` | `server.js:83` | The purple-haired chibi punk, unchanged, including the "must stay EXACTLY identical to the reference" clause |
| `ART_STYLE` | `server.js:94` | Isometric cutaway diorama, low-poly matte plastic, muted grey + purple accents, charcoal `#2b2b2b` ground, 1:1 |
| `SEED_ROOM` + `assets/cell.png` | repo root | Stage 1 is the same cell, so the reference image is already drawn |
| Palette + type | `public/index.html` `:root` | `--bg:#141419`, `--panel:#1e1e26`, `--purple:#8b5cf6`, `--amber:#fbbf24`; Press Start 2P for chrome, Space Mono for anything you actually read |
| `gemini()` + model fallback lists | `server.js:290` | Ordered model preference with graceful degradation, retries — vision instead of text-only |
| `askJSON()` + `responseSchema` | `server.js:319` | Forced structured output, so the client never parses prose |
| Access gate + rate limits | `server.js:55` | `ACCESS_CODE`, `GAMES_PER_IP_PER_HOUR`, `GAMES_PER_DAY` — matters more here, photos cost more than text turns |
| Session store + reaper | `server.js:428` | Same in-memory map, TTL and `MAX_SESSIONS` backstop |
| Chiptune engine | `public/index.html:327` | Full WebAudio synth, no audio files. `blip`/`select`/`confirm`/`thud`/`win`/`lose` already map onto shutter, pass, fail and caught |
| Read-aloud | `public/index.html:544` | `speechSynthesis` with an English voice picker, no files and no API calls |
| `MOCK=1` | `package.json` | Fake judge, no key and no camera needed |
| The punk's voice | `TURN1_LINE` + narrative prompts | "Not again! Yo — get me out of here!" — same energy in every stage brief and verdict line |

## 4. Stage script (7 stages, ~6–8 min run)

| # | Setting | The ask | Accepts | Rejects |
|---|---|---|---|---|
| 1 | Cell Block D | "Something sharp and pointy — I can pick this lock" | pen, pencil, knife, fork, hairclip, scissors, screwdriver, nail | mug, book, pillow |
| 2 | The corridor | "Something dark to throw over myself" | dark jacket, hoodie, blanket, towel, bin bag | anything pale or bright |
| 3 | Laundry | "Something that looks like a uniform — any clothing" | shirt, trousers, jacket, any garment | non-clothing |
| 4 | Guard post | "Something that makes a racket" | keys, phone, alarm clock, bottle, saucepan, instrument | soft or silent things |
| 5 | Mess hall | "Something with a strong smell — the dogs are on me" | food, coffee, spices, spray, perfume, soap | odourless things |
| 6 | The fence | "Something to protect my hands from the wire" | gloves, sock, cloth, oven mitt | paper, thin plastic |
| 7 | The road out | "Something to light the way" | torch, phone, lamp, candle | — |

Difficulty ramps by narrowing the accept set, not by getting stricter. Stage 1 has
dozens of valid matches in any room; stage 6 has a handful. That's deliberate — the
early stages teach the mechanic, the late ones make you get up and go looking.

Each stage is one object in the `STAGES` array in `stages.js`: `{ id, scene, ask,
rubric, accepts, rejects, art }`. Adding, reordering or rewriting a stage is a data
change, not a code change.

## 5. The judge

Client resizes the captured frame, base64s it, POSTs to `/api/judge` with the
session id and stage id. The server holds the key and calls Gemini vision with the
stage rubric and a forced schema:

```js
const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    object:     { type: 'string',  description: 'The single most prominent object, named plainly.' },
    verdict:    { type: 'string',  enum: ['pass', 'fail', 'unreadable'] },
    reason:     { type: 'string',  description: "One line in the punk's voice, shown to the player verbatim." },
    confidence: { type: 'number',  description: '0 to 1, how sure you are about the object.' },
  },
  required: ['object', 'verdict', 'reason', 'confidence'],
};
```

Rules that make it feel fair rather than broken:

- **`unreadable` costs nothing.** Too dark, too blurry, no clear object, or a photo
  of a screen → free retry with a nudge ("I can't see a thing — more light!"). Only
  a confidently-identified *wrong* object burns an attempt. Bad lighting must never
  end a run.
- **Confidence below 0.5 → treat as `unreadable`.** Same reasoning.
- **Judge generously.** A near-miss accepted is charming; a plausible object
  rejected feels like a bug. Rubrics err toward yes.
- **`reason` is where the personality lives.** It's the punk speaking and it's shown
  verbatim, so the system prompt carries a voice guide, not just a rubric.
- **API error, timeout over 12s, or rate limit** → "the light's gone funny", attempt
  not consumed. A flaky phone connection can't kill a run.
- `object` is stored on the session even when it isn't used — that's the hook for
  reactive art later.

## 6. Fail state and counter

Three attempts per stage, drawn as three scratched tally marks struck through on
each miss. Reset on entering a new stage. Zero left → CAUGHT screen showing the
stage reached, then restart the run. A run is short enough (~7 minutes) that
restarting from the top should read as tense rather than punishing — but it's a call
worth revisiting with the slice in hand.

## 7. Screens

1. **Title** — no branding, since it's only ever reached via a tap-through from the NovaPals webview: just "want hints in your language?" and the four language chips. Tapping one sets the language and starts the run in a single action. If the app already passed `?lang=`, the chips never appear at all and the run starts on its own.
2. **Gate** — `ACCESS_CODE` entry when one is set (reuses jailbreak's `RESTRICTED AREA` screen).
3. **Permission primer** — *why* the camera is needed and that nothing is stored,
   then a button that fires the real browser prompt. Never call `getUserMedia` cold;
   a denied prompt is painful to recover from on iOS.
4. **Stage brief** — diorama art, the punk's line with tap-to-hear, "Open camera".
5. **Camera** — full-bleed feed, shutter, tally marks, the ask pinned as a reminder.
6. **Judging** — the captured frame with a develop/scan animation over it.
7. **Verdict** — pass or fail, the punk's line, continue or retry.
8. **Caught** — game over, how far you got, restart.
9. **Escaped** — win, plus a contact sheet of the objects the player actually
   photographed. That montage is the shareable moment of the whole thing.

## 8. Camera handling

- `getUserMedia({ video: { facingMode: 'environment' } })` on `<video playsinline muted>`.
- **HTTPS required.** Phone testing needs the Render URL or a tunnel from day one —
  this game is close to untestable on a desktop dev loop.
- Capture: draw the current frame to an offscreen canvas → `toBlob('image/jpeg', 0.7)`.
- Fallback when `getUserMedia` is unavailable or denied: `<input type="file"
  accept="image/*" capture="environment">` still opens the native camera on mobile
  and gives desktop players file upload. The game stays completable either way.
- Keep the stream alive across a run for smoothness; stop tracks on win, loss and
  tab hide, so the camera indicator goes out.
- Portrait, mobile-first. Desktop playable but second-class.

## 9. Privacy

Photos are held in memory, sent once for judging, and never written to disk or a
database. The server does not log image bytes. This is stated plainly on the
permission primer, because "let this website use your camera" is a far bigger ask
than "click one of four items". The end-of-game contact sheet is session memory only.

## 10. Cost and abuse control

Photo judging costs more per play than jailbreak's text turns, so the guards get
tightened rather than loosened: per-IP hourly cap, global daily backstop,
`ACCESS_CODE` on any public URL, server-enforced max upload (~500KB), and
client-side downscaling that keeps normal play far below it.

## 11. Analytics (PostHog)

`$app_name` is `EscapeJailCamera` on every event (registered once at init), which
is what keeps this prototype's traffic separable from every other app sharing the
project — jailbreak's own events use `EscapeJail` the same way.

Every screen fires PostHog's own pre-existing screen-view event, `$screen`, with
a descriptive `$screen_name` (Title, Camera Permission Primer, Stage Brief,
Camera, Judging, Verdict, Escaped/Caught, …) — the same event the mobile SDKs
send automatically, sent by hand here since this runs in a web view.

Beyond that and the jailbreak events, the ones that tell us whether a rubric is
wrong:

- `stage_started` — stage id, language
- `picture_taken` — stage id, attempt number, source (`camera` or `file`)
- `photo_submitted` — stage id, attempt number
- `picture_feedback_given` — stage id, attempt number, `answer` (`correct` /
  `incorrect`), `object`, confidence — fired only for an actual pass/fail
  judgment, since unreadable/error/timeout never judged an object
- `verdict` — stage id, verdict, `object`, confidence, latency
- `stage_passed` / `stage_failed` — attempts used
- `run_caught` — stage reached
- `run_escaped` — total attempts, total duration
- `camera_denied` / `camera_fallback_used`

`object` on the verdict event is the valuable one: it's a live list of what people
actually point their phones at, which is how the accept sets get tuned.

## 12. i18n

Same split as jailbreak: `public/i18n.js` carries UI chrome for en/es/pt/tr, and it
degrades to English if the fetch fails. The punk's spoken lines stay English in
every language, because an English `speechSynthesis` voice reads them aloud.

The open question was the judge's `reason` line — it's the punk speaking, so by
jailbreak's rule it stays English, but it's also the main feedback the player gets.
A `reasonLocal` alongside it, translated for the on-screen text, was considered and
dropped: for the MVP `reason` is English everywhere. Worth revisiting only if
non-English players actually find the verdicts hard to follow.

## 13. Dev tooling

- `MOCK=1` — fake judge cycling through pass, fail and unreadable after a plausible
  delay. Whole flow testable with no key and no camera.
- `?stage=4` — jump straight to a stage.
- `?verdict=fail` — force every judgement to `pass`, `fail` or `unreadable`. Mock
  mode only. The natural mock cycle never produces three fails in a row, so this is
  the only way to reach the CAUGHT screen on demand.
- A tray of test images, so rubrics can be tuned without standing up to find a hairclip.

## 14. Vertical slice — what got built

Done, and verified in a headless browser against a fake camera:

1. Repo on jailbreak's skeleton — `server.js`, `stages.js`, `public/index.html`, `public/i18n.js`, `.env.example`, `render.yaml`.
2. `gemini()`, `askJSON()`, the session store, rate limiter and access gate ported.
3. `/api/judge` with per-stage rubrics and `JUDGE_SCHEMA`, plus `MOCK=1` and a `?verdict=` override.
4. Client: title → primer → camera → capture → judging → verdict, in the jailbreak palette and type.
5. Tally-mark attempt counter, CAUGHT and OUT screens, contact-sheet of the objects found.
6. Chiptune stings and read-aloud wired to the new moments.
7. `tools/generate-art.js`, so the dioramas are generated once and committed.

Not done, and next:

8. Deploy to Render, play it on a real phone, tune the stage-1 rubric against real objects.
9. Generate the stage art and look hard at whether the character holds together.

## 15. Out of scope for the prototype

Accounts, leaderboards, saved progress, difficulty settings, multiplayer, native app.

## 16. Still open

- **Tune the stage-1 rubric against real objects on a real phone.** Everything
  else is guesswork until that's done. This is the whole point of the slice.
- Whether `unreadable` is generous enough in practice, or whether players find a
  way to burn attempts on photos they think should have counted.
- Whether the asks in stages 2–7 are surprising and funny enough, once someone
  has actually played through them.
- Live stage-art generation, and reactive art on the pass moment — both known
  upgrade paths, both hooked for, neither built.
