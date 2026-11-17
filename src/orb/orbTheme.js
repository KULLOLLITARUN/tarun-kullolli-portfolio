// Every number that shapes the Kairo orb's motion: the state looks, and the timings, curves and
// strengths of the event animations. Both orbs (the hero orb and the 30px header avatar, both
// components/KairoOrb.jsx) read this file through orb/orbController.js, so nothing is hard-coded in
// a renderer. Times are in seconds.

// How each state moves: spin (rad/s), breathe (size), sparks per second-ish, streak stretch.
export const PRESETS = {
  idle: { spin: 0.22, breathe: 0.012, spark: 0.35, stream: 0 },
  thinking: { spin: 0.9, breathe: 0.03, spark: 3.2, stream: 1 },
  speaking: { spin: 0.4, breathe: 0.02, spark: 1.2, stream: 0.4 },
}

// The inner colour per state. It is eased in RGB, so a change passes through a pale glow and never
// through other hues.
export const INNER = { idle: [255, 225, 170], thinking: [90, 200, 255], speaking: [255, 225, 150] }

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
  duration: 1.0, // how long the gold shell takes to expand to full size (ease-out)
  shellFrom: 0.18, // the shell's starting size, as a fraction of its full size
  innerDelay: 0.25, // the inner layers wait this long before snapping in
  innerDuration: 0.5, // how long the inner layers take to snap into place
  innerFrom: 0.5, // the inner layers' starting size, as a fraction of their full size
  heartDim: 0.25, // how bright the heart is at the very start (0 to 1)
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
