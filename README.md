# JAILBREAK: CAMERA

A prison-break game you play with your phone's camera. The punk from
[jailbreak](https://github.com/chris-w-k/jailbreak) is stuck in a cell and can't
reach anything — so he asks *you* for things. Find something sharp and pointy in
whatever room you happen to be in, hold it up, and photograph it. Gemini looks at
the photo and decides whether it'll do.

Seven rooms, three goes each. Three wrong objects and the guard is already behind
you.

Same character, same isometric-diorama art style, same daft voice as jailbreak.
Completely different mechanic: linear instead of branching, and the puzzle is the
room you're actually sitting in.

## Run it

```bash
cp .env.example .env      # then paste a Gemini key in
npm start                 # http://localhost:5173
npm run mock              # no key, no network, no cost — canned verdicts
```

Zero dependencies, Node 18+.

**The camera needs https.** `getUserMedia` is refused on plain http, so
`localhost` works for a desktop webcam and nothing else does — to test on a phone
you need the deployed URL or a tunnel. Plan on doing most of the real testing
against Render.

## Deploy

Render dashboard → New → Blueprint → pick this repo. `render.yaml` does the rest
and prompts for the secrets. Set `ACCESS_CODE` on any public URL: photo judging
costs more per play than jailbreak's text turns did, and the URL is a spend
button on your key otherwise.

## Stage art

The game is linear, so the seven dioramas never change and there's no reason to
generate them at runtime:

```bash
npm run art               # writes assets/stage-1.png … stage-7.png
npm run art -- --force    # redo all of them
npm run art -- 3 5        # redo just those two
```

Character consistency comes from a reference image, same as jailbreak. Drop the
punk into `assets/reference.png` — `cell.png` from the jailbreak repo is the
obvious choice — and every stage is generated against it. With no reference,
stage 1 is generated cold and becomes the reference for the other six.

Look at them before committing; a character that's drifted off-model is worth
regenerating. Until a stage has a PNG the game shows a labelled holding frame,
so it's playable with no art at all.

## Dev switches

| | |
|---|---|
| `MOCK=1` | canned verdicts, no API calls, no camera needed |
| `?stage=5` | start on stage 5 instead of playing four stages first |
| `?verdict=fail` | force every judgement — `pass`, `fail` or `unreadable`. Mock mode only |
| `npm run mock` + `?verdict=fail` | the quickest way to see the CAUGHT screen |

## How the judging works

The client downscales the frame to 768px on its longest edge and posts it to
`/api/judge`. The server holds the key, hands Gemini the stage's rubric and a
forced response schema, and gets back `{ object, verdict, reason, confidence }`.

Three rules do most of the work of making it feel fair rather than broken:

- **`unreadable` costs nothing.** Too dark, too blurry, no clear object, or a
  photo of a screen — free retry with a nudge. Only a confidently-identified
  *wrong* object burns an attempt. A badly-lit room must never end a run.
- **Confidence below 0.5 becomes `unreadable`.** Enforced server-side as well as
  asked for in the prompt. Guessing at a blurry shape and calling it a failure is
  the one thing that would feel like cheating.
- **A judge that errors or times out costs nothing either.** A flaky phone
  connection can't lose you the run.

`reason` is the punk speaking, shown to the player verbatim and read aloud by
`speechSynthesis`, so the system prompt in `server.js` carries a voice guide
rather than just a rubric. Tune the feel of the whole game there; tune individual
difficulty in `stages.js`.

## Layout

```
server.js               http, Gemini vision proxy, sessions, gate, rate limits
stages.js               the seven stages: asks, rubrics, art prompts. Shared
public/index.html       the whole client — screens, camera, chiptune, speech
public/i18n.js          interface strings (en/es/pt/tr)
tools/generate-art.js   one-off stage art generation
assets/                 stage-N.png, committed once generated
```

Adding or reordering a stage is a data change in `stages.js` and nothing else.

## Carried over from jailbreak

`CHARACTER_SHEET` and `ART_STYLE` verbatim, the palette and type, the WebAudio
chiptune engine, the `speechSynthesis` voice picker, the `gemini()` transport with
its model-preference ladder, `askJSON()` with forced schemas, the access gate and
rate limiters, and the shape of the whole thing — one zero-dependency Node file
plus one HTML file.

## What's deliberately not here

Accounts, leaderboards, saved progress, difficulty settings, multiplayer. Live
per-playthrough art generation is the known upgrade path, not the MVP. Reactive
art — the punk drawn using the object *you* photographed — isn't built, but the
judge already stores the identified object name on the session, which is the hook
for it.
