// Every number that shapes the Kairo orb's motion: the state looks, and the timings, curves and
// strengths of the event animations. Both orbs (the hero orb and the 30px header avatar, both
// components/KairoOrb.jsx) read this file through orb/orbController.js, so nothing is hard-coded in
// a renderer. Times are in seconds.

// How each state moves: spin (rad/s), breathe (size), sparks per second-ish, streak stretch (the
// reference's "flash"), act (how lively the glass mass is: edge glow, scratches, bolts) and morph
// (how fast the sheets' folds and the rim loops wobble).
export const PRESETS = {
  idle: { spin: 0.22, breathe: 0.012, spark: 0.35, stream: 0, act: 0.3, morph: 0.45 },
  thinking: { spin: 0.9, breathe: 0.03, spark: 3.2, stream: 1, act: 1, morph: 1.8 },
  speaking: { spin: 0.4, breathe: 0.02, spark: 1.2, stream: 0.4, act: 0.6, morph: 1.0 },
}

// The inner colour per state (the glass mass, heart and bolts). It is eased in RGB, so a change
// passes through a pale glow and never through other hues. The gold outer layer never changes.
export const INNER = { idle: [30, 140, 255], thinking: [90, 220, 255], speaking: [60, 170, 255] }

// The glass mass: how many of each part. Fewer reads cleaner; the avatar gets the small set.
export const MASS = {
  sheets: 18, // translucent glass sheets (the first 6 are the big ones)
  sheetsSmall: 6, // sheets on the 30px avatar
  scratches: 110, // fine light scratches, denser toward the centre
  scratchesSmall: 25, // scratches on the avatar
  sparklets: 40, // cyan glitter (hero only)
  dust: 60, // glittering dust (hero only)
  clouds: 8, // soft drifting clouds (hero only)
  rays: 7, // streaks radiating from the heart (hero only)
  stagger: 0.5, // on wake-up the sheets grow in one after another over this much of the snap
}

// Where the white-hot heart sits (off-centre, in sphere units).
export const HEART = [0.08, -0.04, 0.1]

// Gold shell streaks passing in front of the glass mass are dimmed so the inside stays readable.
export const SHELL_FADE = {
  inside: 0.74, // dim streaks closer to the centre than this (fraction of the radius)
  alpha: 0.22, // how bright they stay
}

// Extra "act" on top of the state's own: typing, the flash and the real-text speaking pulse make
// the sheet edges, scratches and bolts livelier.
export const ENERGY = { typing: 0.35, flash: 0.5, speech: 0.3, max: 1.3 }

// Energy bolts from the heart.
export const BOLTS = {
  base: 0.25, // bolts per second at rest
  perAct: 2.2, // extra bolts per second for each unit of act
  maxActive: 5, // never more bolts than this at once
  lifeMin: 0.1, // shortest bolt life (s)
  lifeMax: 0.3, // longest bolt life (s)
  reachMin: 0.45, // nearest end (fraction of the radius)
  reachMax: 0.72, // farthest end
  jitter: 0.05, // how jagged
}

// How fast the dashes flow along the sheet edges (px/s): base + perAct * act.
export const DASH = { base: 30, perAct: 50 }

// Easing curves, shared by both orbs.
export const EASE = {
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  outBack: (x, s = 1.4) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2), // snaps in with a small overshoot
  smooth: (x) => x * x * (3 - 2 * x),
}

// Canvases this size or smaller get the simplified effects (no rings or travelling pulses).
export const SMALL_MAX = 64

// 1. Wake-up when the chat opens: a dim point, the shell expands, the inner layers snap in.
export const WAKE = {
  duration: 2.2, // how long the gold shell takes to expand to full size (ease-out); the name's particles are still arriving
  shellFrom: 0.6, // the shell's starting size, as a fraction of its full size (the flying-in streaks do the rest)
  innerDelay: 0.9, // the core starts glowing while the shell is still building, then eases up
  innerDuration: 1.5, // how long the inner layers take to glow up (no snap)
  innerFrom: 0.5, // the inner layers' starting size, as a fraction of their full size
  heartDim: 0.25, // how bright the heart is at the very start (0 to 1)
}

// 1b. On wake-up the shell's streaks fly in from scattered spots and settle into the orb (hero only).
export const ASSEMBLE = {
  duration: 2.8, // how long the whole assembly takes (like main's AI-core orb); the name's particles fly in for as long
  spread: 0.5, // pieces start over this fraction of the duration, so they arrive in a stream
  from: [0.9, 1.2], // where a streak starts: distance from the centre (fraction of the radius)
  fadeFrom: 0, // a streak is invisible until its particle has landed on it (0 to 1)
}

// 1c. Light the orb casts on the hero and the chat panel, in the inner colour.
export const LIGHT = {
  base: 0.38, // resting strength (0 to 1)
  heart: 0.25, // extra while typing
  flash: 0.4, // extra at the flash
  speech: 0.2, // extra with the speaking pulse
  thinking: 0.15, // extra while thinking
  ease: 4, // how fast it follows (per second)
  chat: 0.55, // how strongly it lights the top of the chat panel (fraction of the strength)
  colourStep: 2, // the tint is rewritten only when the inner colour moves this much (saves repaints)
}

// 2. Reaction to typing: the heart brightens and every keystroke sends a soft ring outward.
export const TYPING = {
  hold: 0.9, // the heart stays bright this long after the last keystroke
  heartSwell: 0.18, // how much larger the white-hot heart gets while typing (fraction)
  glow: 0.1, // extra inner-glow strength while typing
  heartEase: 6, // how fast the heart brightens and relaxes (per second)
  maxPerSec: 8, // at most this many rings per second
  maxRings: 6, // never more rings than this on screen
  ringLife: 0.8, // how long one ring takes to travel from the heart to the shell
  ringFrom: 0.12, // where the ring starts (fraction of the shell radius)
  ringTo: 1.04, // where the ring ends
  ringStrength: 0.45, // how much a ring brightens the shell streaks it crosses
  ringWidth: 0.1, // how thick the lit band is (fraction of the shell radius)
}

// 2b. On send the whole orb squeezes, then releases into the thinking state.
export const CONTRACT = {
  amount: 0.06, // how much smaller the orb gets (6%)
  inTime: 0.06, // time to squeeze
  holdTime: 0.09, // time held squeezed (in + hold is about 150 ms)
  releaseTime: 0.2, // time to release
}

// 3. Thinking as a visible process: a few pulses of light travel from the heart to the shell.
export const THINK = {
  interval: 0.55, // average gap between new pulses
  maxActive: 3, // never more than this many travelling at once
  life: 0.95, // how long a pulse takes to reach the shell
  trail: 0.22, // length of a pulse's tail (fraction of the shell radius)
  width: 1.8, // line width of a pulse (scaled with the orb's size)
}

// 3b. The first response token: one bright flash that hits the shell, then speaking.
export const FLASH = {
  duration: 0.6, // total length of the flash
  hitAt: 0.55, // fraction of the flash at which the ring reaches the shell
  strength: 1.1, // how much the flash brightens the shell streaks it crosses
  width: 0.14, // thickness of the flash band (fraction of the shell radius)
  shellBoost: 0.8, // extra shell brightness held for a moment after the hit
  glow: 0.22, // extra ambient glow at the peak
  heartSwell: 0.5, // how much the heart swells at the peak (fraction)
}

// 4. Speaking tied to the real text: each chunk or sentence bumps the pulse, which decays.
export const BUMP = {
  gain: 0.7, // how much one bump of strength 1 adds to the pulse
  decay: 0.28, // how fast the pulse dies away between bumps (time constant)
  freshFor: 1.2, // real text counts as "arriving" this long after the last bump
  floor: 0.35, // resting level of the speaking pulse while real text is arriving
  ease: 6, // how fast the orb moves between the synthetic and the real pulse (per second)
}
