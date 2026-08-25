/**
 * JAILBREAK: CAMERA — the game data.
 *
 * Shared by server.js (rubrics, asks) and tools/generate-art.js (art prompts),
 * so a stage is described in exactly one place. Adding a stage is a data change.
 *
 * The character sheet and art style are carried over verbatim from
 * chris-w-k/jailbreak, so the two prototypes read as siblings.
 */

const CHARACTER_SHEET = [
  'THE SAME recurring character in every image: a stylised toy-like punk teenager,',
  'large head and small body (chibi vinyl-figure proportions), warm tan-brown skin,',
  'tall messy spiked bright purple hair, black wraparound wedge sunglasses,',
  'open-mouthed shouting grin, small gold hoop earring on the left ear,',
  'a black sleeveless studded leather vest over a white t-shirt,',
  'a purple belt with a square buckle, bright blue jeans with a small lightning bolt on one thigh,',
  'chunky dark grey boots, black studded wristbands, a small tattoo on the upper left arm.',
  'His face, hair, sunglasses and outfit must stay EXACTLY identical to the reference image.',
].join(' ');

const ART_STYLE = [
  'Isometric 3D render of a small cutaway diorama room, viewed from a fixed 45-degree top-down angle.',
  'Two walls forming an L in the back-left and back-right, open front, thick slab floor with a visible base edge.',
  'Cute stylised low-poly toy aesthetic, smooth matte plastic materials, soft rounded bevelled edges,',
  'soft neutral studio lighting with gentle contact shadows, no harsh speculars.',
  'Muted grey and off-white palette with saturated purple and blue accents.',
  'Plain dark charcoal (#2b2b2b) empty background around the diorama. Square 1:1 composition,',
  'diorama centred with generous margin. No text captions, no watermarks, no UI, no border frame.',
].join(' ');

/**
 * The linear run. One stage = one ask = one photo.
 *
 *   ask        what the punk says out loud. English in every language, because an
 *              English speechSynthesis voice reads it aloud.
 *   rubric     the judging criterion, in plain words, handed to the vision model.
 *   accepts    example objects that must pass. Illustrative, not exhaustive —
 *              the model generalises from them.
 *   rejects    example objects that must fail. These stop the rubric drifting so
 *              loose that everything passes.
 *   scene      the room name shown in the HUD.
 *   art        the diorama prompt for tools/generate-art.js.
 *
 * Difficulty ramps by narrowing the accept set, not by getting stricter. Stage 1
 * has dozens of valid matches in any room; stage 6 has a handful. The early
 * stages teach the mechanic, the late ones make you get up and go looking.
 */
const STAGES = [
  {
    id: 'lockpick',
    scene: 'Cell Block D',
    ask: 'Find me something sharp and pointy — I can pick this lock!',
    rubric: 'An object with a thin, narrow or pointed end that could plausibly be poked into a lock: a pen, pencil, knife, fork, hairclip, paperclip, nail, screwdriver, scissors, key, skewer, tweezers, safety pin.',
    accepts: ['a ballpoint pen', 'a pencil', 'a kitchen knife', 'a fork', 'a hairclip', 'a paperclip', 'scissors', 'a screwdriver', 'a nail'],
    rejects: ['a mug', 'a book', 'a pillow', 'a banana', 'a shoe'],
    art: [
      'A grimy prison cell diorama.',
      'The punk character crouches at a heavy grey steel cell door on the right, one eye pressed to the lock, gesturing impatiently out of the frame towards the viewer.',
      'Grey cinderblock brick walls with hairline cracks and small anarchy-symbol graffiti tags.',
      'A low grey metal bunk bed with a thin mattress and a white pillow along the back wall, a stack of comic books on it.',
      'On the left wall: a small steel sink with a blue cup holding a red toothbrush, and a steel prison toilet beside it.',
      'A small barred window high on the back wall throwing a pale shaft of light onto the floor.',
      'A few chunks of rubble on the floor.',
    ].join(' '),
  },
  {
    id: 'cover',
    scene: 'The Corridor',
    ask: "Something dark I can throw over myself — quick, before he looks!",
    rubric: 'Any dark-coloured object large enough to cover a person: a dark jacket, hoodie, coat, blanket, towel, sheet, bin bag, dark bag, dark cloth. It must read as dark in the photo — black, charcoal, navy, dark brown, dark green.',
    accepts: ['a black hoodie', 'a dark jacket', 'a navy blanket', 'a black bin bag', 'a dark towel'],
    rejects: ['a white t-shirt', 'a pale pillowcase', 'a bright yellow coat', 'a mug', 'a pen'],
    art: [
      'A long prison corridor diorama seen as a cutaway.',
      'The punk character presses flat against the left wall, peering around a corner with an exaggerated wide-eyed grin.',
      'Rows of grey steel cell doors with small barred hatches down the right wall, pale institutional green lower wall and grey upper wall.',
      'A caged ceiling light casting a pool of light on a polished grey floor with a long painted line down the middle.',
      'A wall-mounted camera in the far corner and a fire bucket on the floor.',
    ].join(' '),
  },
  {
    id: 'uniform',
    scene: 'The Laundry',
    ask: 'I need a uniform. Any clothes will do — hold something up!',
    rubric: 'Any item of clothing or wearable garment: a shirt, t-shirt, trousers, jeans, jacket, coat, jumper, dress, hat, cap, sock, shoe, uniform, apron, hi-vis vest. Colour does not matter here.',
    accepts: ['a shirt', 'jeans', 'a jumper', 'a cap', 'a sock', 'a hi-vis vest'],
    rejects: ['a towel', 'a cushion', 'a mug', 'a laptop', 'a plant'],
    art: [
      'A prison laundry room diorama.',
      'The punk character stands waist-deep in a large wheeled canvas laundry cart piled with grey and white clothing, arms thrown up in triumph.',
      'Two big front-loading industrial washing machines against the back wall, one with its door open.',
      'A folding table with neat stacks of folded grey uniforms, an iron, and a wire rack of hanging shirts.',
      'Pale tiled walls, a floor drain, and a warm haze of steam near the ceiling.',
    ].join(' '),
  },
  {
    id: 'noise',
    scene: 'The Guard Post',
    ask: "Something that makes a racket! I need him looking the other way.",
    rubric: 'An object that could make a loud noise if thrown, shaken, dropped or set off: keys, a phone, an alarm clock, a bell, a bottle, a tin, a saucepan, cutlery, a musical instrument, a toy that makes noise, a speaker, a whistle, a bunch of coins.',
    accepts: ['a bunch of keys', 'a mobile phone', 'an alarm clock', 'a saucepan', 'a glass bottle', 'a guitar', 'a whistle'],
    rejects: ['a pillow', 'a sock', 'a towel', 'a sheet of paper', 'a cushion'],
    art: [
      'A prison guard post diorama, a small glass-fronted control booth.',
      'The punk character ducks below the counter on the near side, finger to his lips, cheeks puffed with held-in laughter.',
      'A swivel chair, a desk with a bank of small CRT monitors showing grey corridors, a mug of tea, a clipboard and a walkie-talkie.',
      'A big red button on the wall and a board of hanging numbered keys.',
      'Pale grey walls with a strip of blue trim, harsh overhead strip lighting.',
    ].join(' '),
  },
  {
    id: 'smell',
    scene: 'The Mess Hall',
    ask: 'The dogs are on me! Something with a strong smell — anything!',
    rubric: 'An object with a strong or distinctive smell: any food or drink, coffee, tea, spices, herbs, fruit, cheese, onion, garlic, vinegar, cleaning spray, bleach, soap, shampoo, deodorant, perfume, aftershave, a scented candle, a bin.',
    accepts: ['a jar of coffee', 'an onion', 'a bottle of cleaning spray', 'a bar of soap', 'a bottle of perfume', 'a banana'],
    rejects: ['a pen', 'a book', 'a phone', 'a spoon', 'a chair'],
    art: [
      'A prison mess hall diorama.',
      'The punk character crouches on top of a long canteen table, glancing over his shoulder with an exaggerated worried grin.',
      'Two long tables with fixed bench seating, metal trays and beige plastic cups on them.',
      'A stainless steel serving counter along the back wall with a heat lamp, a big pot, and a stack of trays.',
      'Pale green tiled walls, a wall clock, and a swing door with a round porthole window.',
    ].join(' '),
  },
  {
    id: 'hands',
    scene: 'The Fence',
    ask: "This wire'll shred me. Something to protect my hands!",
    rubric: 'An object that could be wrapped around or worn on the hands as padding: gloves, mittens, an oven glove, a sock, a scarf, a thick cloth, a tea towel, a rag, a jumper sleeve, a folded towel, bubble wrap, a thick rubber mat.',
    accepts: ['a pair of gloves', 'an oven glove', 'a sock', 'a scarf', 'a thick tea towel'],
    rejects: ['a sheet of paper', 'a thin plastic bag', 'a pen', 'a phone', 'a plate'],
    art: [
      'A night-time prison yard perimeter diorama.',
      'The punk character stands at the base of a tall chain-link fence topped with coiled razor wire, hands raised and fingers spread wide, mouth open in a shout.',
      'Cracked concrete ground with weeds pushing through, a puddle reflecting purple light.',
      'A floodlight on a pole throwing a hard cone of light, a warning sign on the fence, sandbags stacked in the corner.',
      'Deep blue-grey night palette with strong purple rim light on the character.',
    ].join(' '),
  },
  {
    id: 'light',
    scene: 'The Road Out',
    ask: "It's pitch black out here. Something to light the way and we're gone!",
    rubric: 'An object that emits light or could be used as a light source: a torch, a phone, a lamp, a desk light, a candle, a lighter, matches, a bike light, a lit screen, a head torch, fairy lights, a lantern.',
    accepts: ['a torch', 'a mobile phone', 'a desk lamp', 'a candle', 'a lighter', 'a bike light'],
    rejects: ['a mug', 'a sock', 'a book', 'a fork', 'a plant'],
    art: [
      'A dark country road diorama just outside the prison walls.',
      'The punk character runs towards the viewer along a narrow tarmac road, both fists pumping, sunglasses flashing, absolutely delighted.',
      'The prison wall and a floodlit watchtower receding small in the background behind him.',
      'Verges of long grass, a bent road sign, a wooden fence post, a puddle catching purple light.',
      'Deep blue-black night palette, a small warm pool of light around the character, stars overhead.',
    ].join(' '),
  },
];

const TOTAL_STAGES = STAGES.length;
const ATTEMPTS_PER_STAGE = 3;

module.exports = { CHARACTER_SHEET, ART_STYLE, STAGES, TOTAL_STAGES, ATTEMPTS_PER_STAGE };
