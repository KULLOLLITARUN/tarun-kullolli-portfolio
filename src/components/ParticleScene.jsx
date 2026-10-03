import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { profile } from '../data.js'
import { faceState } from '../chat/faceState.js'
import { stationDone } from '../hooks.js'

const TEXT_W = 10 // name block width in "name space" units
const STAR_COLORS = ['#f4f4f5', '#a78bfa', '#60a5fa', '#f5b544', '#f472b6', '#38bdf8', '#fb7185']
// Muted tints for the large background orbs: red, blue, gold, purple, warm white.
const ORB_COLORS = ['#ff8577', '#7fa8ff', '#f5c56b', '#b394ff', '#fff1e0']
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed))

// ── Responsive layout, in world units (camera z=10, fov 35) ──────────
function layout(viewport, wide) {
  const { width: vw, height: vh } = viewport
  if (wide) {
    return {
      nameA: { x: 0, y: vh * 0.05, s: Math.min(1, (vw * 0.84) / TEXT_W) },
      nameB: { x: -vw * 0.25, y: vh * 0.11, s: Math.min((vw * 0.38) / TEXT_W, vh * 0.05) },
      face: { x: vw * 0.25, y: vh * 0.2, s: vh * 0.5 },
    }
  }
  return {
    nameA: { x: 0, y: vh * 0.08, s: (vw * 0.8) / TEXT_W },
    nameB: { x: 0, y: vh * 0.31, s: (vw * 0.56) / TEXT_W },
    face: { x: 0, y: vh * 0.1, s: vh * 0.34 },
  }
}

// Window-level pointer, because the canvas sits underneath the hero UI.
function usePointer() {
  const ndc = useRef(null)
  useEffect(() => {
    const move = (e) => {
      ndc.current = { x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 }
    }
    const leave = () => (ndc.current = null)
    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
    }
  }, [])
  return ndc
}

function sampleCanvas(w, h, draw, step, threshold = 140) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  draw(ctx)
  const data = ctx.getImageData(0, 0, w, h).data
  const pts = []
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] > threshold) pts.push([x, y])
  return pts
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Each word is sampled once, then placed in two layouts:
// A = one line (intro), B = stacked & left-aligned (after the split).
function buildName(words, maxPoints) {
  const size = 220
  const font = `600 ${size}px Geist, system-ui, sans-serif`
  const measure = document.createElement('canvas').getContext('2d')
  measure.font = font
  if ('letterSpacing' in measure) measure.letterSpacing = `${size * 0.04}px`
  const sampled = words.map((word) => {
    const width = Math.ceil(measure.measureText(word).width)
    const h = Math.ceil(size * 1.3)
    const pts = sampleCanvas(width + 20, h, (ctx) => {
      ctx.font = font
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * 0.04}px`
      ctx.fillStyle = '#fff'
      ctx.textBaseline = 'middle'
      ctx.fillText(word, 10, h / 2)
    }, 2) // 2px grid: enough points for the larger particle counts (trimmed to maxPoints below)
    return { width, pts: shuffle(pts.map(([x, y]) => [x - 10, y - h / 2])) }
  })
  const total = sampled.reduce((n, w) => n + w.pts.length, 0)
  const ratio = Math.min(1, maxPoints / total)
  sampled.forEach((w) => (w.pts = w.pts.slice(0, Math.round(w.pts.length * ratio))))

  const gap = size * 0.45
  const lineW = sampled.reduce((n, w) => n + w.width, 0) + gap * (sampled.length - 1)
  const sA = TEXT_W / lineW
  const maxW = Math.max(...sampled.map((w) => w.width))
  const sB = TEXT_W / maxW
  const lineH = size * 0.98

  const count = sampled.reduce((n, w) => n + w.pts.length, 0)
  const a = new Float32Array(count * 3)
  const b = new Float32Array(count * 3)
  const delay = new Float32Array(count)
  let k = 0
  let xCursor = -lineW / 2
  sampled.forEach((w, wi) => {
    const yB = ((sampled.length - 1) / 2 - wi) * lineH
    for (const [px, py] of w.pts) {
      const z = (Math.random() - 0.5) * 0.08
      a.set([(xCursor + px) * sA, -py * sA, z], k * 3)
      b.set([(-maxW / 2 + px) * sB, (yB - py) * sB, z], k * 3)
      delay[k] = Math.min(1, ((xCursor + px + lineW / 2) / lineW) * 0.85 + Math.random() * 0.15)
      k++
    }
    xCursor += w.width + gap
  })
  return { a, b, delay, count }
}

// Points inside a word, normalised to its text box (0–1 across the advance width, 0–1 down the
// font's ascent+descent), matching the DOM element's box so they can be mapped onto it.
// Font settings mirror .contact-title (Geist 300, -0.03em tracking).
function sampleWord(text, weight = 300, trackingEm = -0.03) {
  const size = 200
  const font = `${weight} ${size}px Geist, system-ui, sans-serif`
  const ctx0 = document.createElement('canvas').getContext('2d')
  ctx0.font = font
  if ('letterSpacing' in ctx0) ctx0.letterSpacing = `${size * trackingEm}px`
  const m = ctx0.measureText(text)
  const asc = m.fontBoundingBoxAscent || size * 0.95
  const desc = m.fontBoundingBoxDescent || size * 0.25
  const w = Math.max(1, Math.ceil(m.width))
  const h = Math.ceil(asc + desc)
  const pts = sampleCanvas(w + 8, h, (ctx) => {
    ctx.font = font
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * trackingEm}px`
    ctx.fillStyle = '#fff'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(text, 0, asc)
  }, 2)
  return shuffle(pts.map(([x, y]) => [x / w, y / h]))
}

// ── Shaders ─────────────────────────────────────────────────────────
const fragment = /* glsl */ `
uniform vec3 uAccent;
varying vec3 vColor;
varying float vAlpha;
varying float vForce;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float core = smoothstep(0.5, 0.0, d);
  float a = core * core * 0.9 + core * 0.25;
  gl_FragColor = vec4(mix(vColor, uAccent, clamp(vForce * 1.4, 0.0, 1.0)), a * vAlpha);
}
`

const MAX_CARDS = 8
const MAX_PANELS = 8 // skill panels traced in section 4
// A station's particles leave for the next one once its bottom edge is this far down the
// screen (so it dissolves as it scrolls away, not while it is being read), with at least
// MIN_FLIGHT screens of scrolling for the flight itself.
const LEAVE_AT = 0.3
const MIN_FLIGHT = 0.25
const SWEEP_S = 2.4 // duration of each light sweep across the name
// Eased sweep position in name space: glides in, lingers across the letters, glides out.
const sweepX = (k) => -8 + 16 * (0.5 - 0.5 * Math.cos(Math.PI * k))

// Name particles, with a scroll-driven "journey": the crisp name dissolves into
// these particles, they drift out as dust to the screen edges, then fly into
// the project cards as each card scrolls into view. Scrolling up reverses it.
const nameVertex = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uSplit;
uniform float uFade;
uniform vec2 uMouse;
uniform float uSize;
uniform float uPixelRatio;
uniform float uDissolve;
uniform float uCount;
uniform vec4 uRects[${MAX_CARDS}];
uniform float uTravel[${MAX_CARDS}];
uniform float uLate[${MAX_CARDS}]; // 1 for cards below the first row
uniform vec3 uGroupPos;
uniform float uGroupScale;
uniform vec2 uView;
uniform float uScanX;
uniform float uScanGold; // 1 = golden sweep, 0 = white sweep
uniform vec4 uSpot; // hover spotlight: xy centre, z radius (name space), w strength
// Timeline station (section 3): progress, line ends (world x0,y0,x1,y1), act dots, dot radius.
uniform float uTl;
uniform vec4 uLine;
uniform vec2 uDots[4];
uniform float uDotCount;
uniform float uDotR;
uniform vec4 uActs[4]; // act glass panels (world centre x,y + size w,h)
// Skills station (section 4): progress, panel rects (world centre x,y + size w,h),
// cumulative share of the total perimeter per panel, and the panel count.
uniform float uSkT;
uniform vec4 uSk[${MAX_PANELS}];
uniform float uSkCum[${MAX_PANELS}];
uniform float uSkCount;
// Contact finale (section 5): progress, the highlighted word's box (world left, top, w, h),
// and the two buttons (world centre x,y + size w,h).
uniform float uCt;
uniform vec4 uWord;
uniform vec4 uBtn[2];
uniform float uBtnCount;
attribute vec2 aWord;
attribute vec3 aTarget;
attribute vec3 aStart;
attribute float aRand;
attribute float aDelay;
attribute float aCardSel;
attribute vec2 aUV;
attribute vec3 aOff;
varying vec3 vColor;
varying float vAlpha;
varying float vForce;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
vec3 toLocal(vec3 w) { return (w - uGroupPos) / uGroupScale; }

// One leg of the journey (world space): a curve that bows out to one side by a random amount
// (bow = how far, as a share of the screen width) with flowing turbulence mid-flight.
vec3 flowPath(vec3 a, vec3 b, float e, float bow, float turb) {
  float side = aOff.x < 0.0 ? -1.0 : 1.0;
  vec3 ctrl = vec3(mix(b.x, side * uView.x * bow, abs(aOff.x)), (a.y + b.y) * 0.5, aOff.z * 1.2 * bow / 0.3);
  float it = 1.0 - e;
  vec3 p = it * it * a + 2.0 * it * e * ctrl + e * e * b;
  p += vec3(
    sin(p.y * 1.3 + uTime * 0.8 + aRand * 6.28),
    cos(p.x * 1.1 - uTime * 0.7 + aRand * 3.0),
    sin(uTime * 0.5 + aRand * 9.0)
  ) * turb * sin(e * 3.14159);
  return p;
}

// A point on the outline of a rect (world centre x,y + size w,h); u = 0…1 around it.
vec2 rectPoint(vec4 b, float u) {
  float d = u * 2.0 * (b.z + b.w);
  float l = b.x - b.z * 0.5;
  float r = b.x + b.z * 0.5;
  float t = b.y + b.w * 0.5;
  float btm = b.y - b.w * 0.5;
  if (d < b.z) return vec2(l + d, t);
  if (d < b.z + b.w) return vec2(r, t - (d - b.z));
  if (d < 2.0 * b.z + b.w) return vec2(r - (d - b.z - b.w), btm);
  return vec2(l, btm + (d - 2.0 * b.z - b.w));
}

// A point on the outline of a pill-shaped button (rect with fully rounded ends); u = 0…1.
vec2 pillPoint(vec4 b, float u) {
  float rad = min(b.z, b.w) * 0.5;
  float straight = max(0.0, b.z - 2.0 * rad);
  float arc = 3.14159 * rad;
  float d = u * (2.0 * straight + 2.0 * arc);
  float l = b.x - straight * 0.5;
  float r = b.x + straight * 0.5;
  if (d < straight) return vec2(l + d, b.y + rad);
  d -= straight;
  if (d < arc) {
    float a = 1.5708 - d / rad;
    return vec2(r + cos(a) * rad, b.y + sin(a) * rad);
  }
  d -= arc;
  if (d < straight) return vec2(r - d, b.y - rad);
  d -= straight;
  float a2 = -1.5708 - d / rad;
  return vec2(l + cos(a2) * rad, b.y + sin(a2) * rad);
}

// Where this particle lands on the timeline (h = its position along the line, 0 = start):
// half trace the act's glass card, the rest gather at the act's dot or draw the line.
vec3 timelineTarget(float h) {
  float pick = fract(aRand * 53.3 + aOff.x * 7.7);
  if (pick < 0.65 && uDotCount > 0.5) {
    float di = min(floor(h * uDotCount), uDotCount - 1.0);
    vec2 c = uDots[0];
    vec4 card = uActs[0];
    for (int i = 1; i < 4; i++) {
      if (float(i) == di) {
        c = uDots[i];
        card = uActs[i];
      }
    }
    if (pick < 0.5) return vec3(rectPoint(card, fract(aRand * 23.7 + aOff.z * 4.1)), 0.0);
    float ang = fract(aRand * 37.7) * 6.28318;
    return vec3(c + vec2(cos(ang), sin(ang)) * sqrt(fract(aRand * 17.3)) * uDotR, 0.0);
  }
  vec2 dir = normalize(uLine.zw - uLine.xy + vec2(1e-5));
  vec2 perp = vec2(-dir.y, dir.x);
  return vec3(mix(uLine.xy, uLine.zw, h) + perp * (fract(aRand * 29.1) - 0.5) * uDotR * 0.3, 0.0);
}

// A point on the outline of one skill panel. Panels get particles in proportion to their
// perimeter; bi returns which panel (for the one-after-another order).
vec3 skillTarget(out float bi) {
  float pick = fract(aRand * 61.3 + aOff.x * 2.1);
  vec4 b = uSk[0];
  bi = 0.0;
  float start = 0.0;
  for (int i = 0; i < ${MAX_PANELS}; i++) {
    if (float(i) < uSkCount && pick >= start) {
      bi = float(i);
      b = uSk[i];
    }
    start = uSkCum[i];
  }
  return vec3(rectPoint(b, fract(aRand * 17.9 + aOff.z * 5.3)), 0.0);
}
void main() {
  // Left-to-right sweep: the name is "written" as the particles land.
  float p = clamp((uProgress - aDelay * 0.55) / 0.45, 0.0, 1.0);
  p = p * p * p * (p * (p * 6.0 - 15.0) + 10.0);
  vec3 s = aStart;
  s.xz = rot(uTime * 0.25) * s.xz;
  s.yz = rot(0.4) * s.yz;
  vec3 target = mix(position, aTarget, uSplit);
  vec3 pos = mix(s, target, p);
  pos.z += sin(p * 3.14159) * (aRand - 0.5) * 3.0;
  // Mid-split particles lift off the plane, then settle again.
  pos.z += sin(uSplit * 3.14159) * (aRand - 0.5) * 1.6;
  pos.xy += vec2(sin(uTime * 0.9 + aRand * 60.0), cos(uTime * 0.7 + aRand * 45.0)) * mix(0.03, 0.005, p);

  // ── Journey: a river of particles flowing from the name to each card ──
  float ci = min(floor(aCardSel * uCount), uCount - 1.0);
  vec4 r = uRects[0];
  float T = 0.0;
  float late = 0.0;
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (float(i) == ci) {
      r = uRects[i];
      T = uTravel[i];
      late = uLate[i];
    }
  }
  // Each particle lags a little behind its card's progress, so the stream stretches like a comet tail.
  float tp = clamp((T - aRand * 0.25) / 0.75, 0.0, 1.0);
  float e = tp * tp * (3.0 - 2.0 * tp);
  vec3 nameW = pos * uGroupScale + uGroupPos;
  vec3 cardW = vec3(r.x + (aUV.x - 0.5) * r.z, r.y - (aUV.y - 0.5) * r.w, 0.0);
  // Leg 1, name → card: a wide, lively river.
  vec3 pathW = flowPath(nameW, cardW, e, 0.3, 0.28);

  // Leg 2, card → timeline: ~70% of the particles continue.
  // The line is drawn left to right (particles further along the line leave a little later).
  float h = fract(aRand * 91.7 + aOff.z * 3.1);
  float cont = step(aOff.y, 0.7);
  float t2 = clamp((uTl - h * 0.3 - aRand * 0.1) / 0.55, 0.0, 1.0) * cont;
  float e2 = t2 * t2 * (3.0 - 2.0 * t2);
  // Particles resting in a card leave from its bottom edge (not across its face, over the text).
  vec3 from2 = e >= 0.999 ? vec3(cardW.x, r.y - r.w * 0.5, 0.0) : pathW;
  vec3 tlW = timelineTarget(h);
  if (e2 > 0.0) pathW = flowPath(from2, tlW, e2, 0.2, 0.2);

  // Leg 3, timeline → skill panels: ~55% of all particles (a subset of the timeline ones)
  // leave the line and trace the panels' outlines, one panel after another.
  float bi;
  vec3 skW = skillTarget(bi);
  float cont3 = step(aOff.y, 0.55) * step(0.5, uSkCount);
  float t3 = clamp((uSkT - bi / max(uSkCount, 1.0) * 0.4 - aRand * 0.1) / 0.4, 0.0, 1.0) * cont3;
  float e3 = t3 * t3 * (3.0 - 2.0 * t3);
  vec3 from3 = e2 >= 0.999 ? tlW : pathW;
  if (e3 > 0.0) pathW = flowPath(from3, skW, e3, 0.18, 0.18);

  // Leg 4, skill panels → Contact finale: ~50% of all particles (a subset of the skills ones).
  // 70% form the highlighted word ("intelligent"), 30% trace the two buttons, word first.
  float kind = step(0.7, fract(aRand * 41.3 + aOff.z * 2.9)) * step(0.5, uBtnCount); // 1 = button
  vec3 ctW = vec3(uWord.x + aWord.x * uWord.z, uWord.y - aWord.y * uWord.w, 0.0);
  if (kind > 0.5) {
    vec4 bb = (fract(aRand * 7.1) > 0.5 && uBtnCount > 1.5) ? uBtn[1] : uBtn[0];
    ctW = vec3(pillPoint(bb, fract(aRand * 13.3 + aOff.x * 3.3)), 0.0);
  }
  float cont4 = step(aOff.y, 0.5) * step(0.001, uWord.z);
  float t4 = clamp((uCt - kind * 0.2 - aRand * 0.1) / 0.5, 0.0, 1.0) * cont4;
  float e4 = t4 * t4 * (3.0 - 2.0 * t4);
  vec3 from4 = e3 >= 0.999 ? skW : pathW;
  if (e4 > 0.0) pathW = flowPath(from4, ctW, e4, 0.18, 0.18);

  if (uCount > 0.5) pos = toLocal(pathW);
  float dd = e;
  // Mid-flight the river is brighter and a little larger than the stars, so it reads clearly
  // against the white star field (it also turns cyan, see vColor below).
  float flight = uCount > 0.5 ? smoothstep(0.0, 0.15, e) * (1.0 - smoothstep(0.8, 1.0, e)) : 0.0;
  // Later legs get the same in-flight boost as the first river, so they read clearly.
  float flightOn = sin(e2 * 3.14159) * (1.0 - smoothstep(0.94, 1.0, e2)) + sin(e3 * 3.14159) + sin(e4 * 3.14159);
  flight = max(flight, clamp(flightOn, 0.0, 1.0) * smoothstep(0.96, 1.0, T) * step(0.5, uCount));
  // Cards below the first row: their particles stay invisible in transit and only
  // appear near the card, so the card condenses out of sparkles as it scrolls in.
  float lateVis = uCount > 0.5 ? mix(1.0, smoothstep(0.7, 0.92, e), late) : 1.0;
  // Card-outline emphasis fades once a particle moves on to the timeline.
  float cc = e * (1.0 - e2);
  float cp = T;

  // Hover spotlight: these particles show only inside the circle the crisp name is masked out of.
  float spot = (1.0 - smoothstep(uSpot.z * 0.55, uSpot.z, length(target.xy - uSpot.xy))) * uSpot.w * (1.0 - dd);

  // Cursor push only while the particles are still the name. Under the spotlight it is
  // a gentle jitter instead, so the dots keep the letter shapes.
  vec2 d = pos.xy - uMouse;
  float dist = length(d);
  float f = (1.0 - smoothstep(0.0, 1.2, dist)) * (1.0 - dd);
  pos.xy += (d / max(dist, 0.001)) * f * mix(0.5, 0.08, uSpot.w);
  pos.z += f * mix(0.8, 0.15, uSpot.w);
  pos.xy += vec2(sin(uTime * 3.0 + aRand * 40.0), cos(uTime * 2.6 + aRand * 70.0)) * 0.035 * spot;

  // Light sweep across the name (golden after forming, white after the split).
  // A wide, soft band (~1.5 letters) so it reads as light gliding over the letters.
  float scan = exp(-pow((target.x - uScanX) * 1.0, 2.0)) * p * (1.0 - dd);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float edge = step(min(min(aUV.x, 1.0 - aUV.x), min(aUV.y, 1.0 - aUV.y)), 0.001);
  gl_PointSize = uSize * uPixelRatio * (0.55 + aRand * 0.6 + edge * cc * 0.35) * (1.0 + scan * 0.6) * (1.0 + 0.3 * flight) / -mv.z;
  // White as the name; a few amber sparks appear only once the river is flowing.
  // The name is white; once the particles leave it they turn the cards' cyan (#7dd3fc),
  // except a few amber sparks.
  float journeyT = uCount > 0.5 ? smoothstep(0.0, 0.2, dd) : 0.0;
  vec3 col = mix(vec3(0.96), vec3(0.49, 0.83, 0.99), journeyT);
  col = mix(col, vec3(0.96, 0.71, 0.27), step(0.97, aRand) * smoothstep(0.0, 0.15, dd));
  // Particles forming the finale word turn its amber as they settle into it.
  col = mix(col, vec3(0.96, 0.71, 0.27), (1.0 - kind) * smoothstep(0.5, 1.0, e4));
  // Card outlines glow icy blue as they lock into place.
  vColor = mix(col, vec3(0.62, 0.86, 1.0), edge * cc * 0.85);
  // Particles hand over to the glass card once it has fully formed, reappear while they travel
  // on to the timeline, and hand over again to the timeline's line and dots.
  float atCard = smoothstep(0.96, 1.0, cp) * step(0.5, uCount);
  // Landed particles stay lit on the outline until their card fades in (same timing as the
  // --reveal values set in JS), then cross-fade into it, so the outline never blinks out.
  // When the next leg starts, the particles that move on light up again while the element
  // fades out (JS: 1 - smoothstep(0, 0.05, next leg)), so a station dissolves into its
  // particles, and on the way back up it re-forms from them.
  float f2 = min(0.85, 0.65 + 0.3 * floor(h * uDotCount) / max(uDotCount, 1.0));
  float keep2 = max(1.0 - smoothstep(f2 + 0.05, f2 + 0.15, uTl), cont3 * smoothstep(0.0, 0.05, uSkT));
  float pre2 = cont * smoothstep(0.0, 0.05, uTl);
  float transit2 = max(smoothstep(0.0, 0.04, e2), pre2) * mix(1.0, keep2, smoothstep(0.9, 1.0, e2));
  float f3 = min(0.85, 0.5 + 0.4 * bi / max(uSkCount, 1.0));
  float keep3 = max(1.0 - smoothstep(f3 + 0.05, f3 + 0.15, uSkT), cont4 * smoothstep(0.0, 0.05, uCt));
  float transit3 = smoothstep(0.0, 0.04, e3) * mix(1.0, keep3, smoothstep(0.9, 1.0, e3));
  float f4 = kind > 0.5 ? 0.82 : 0.62;
  float keep4 = 1.0 - smoothstep(f4 + 0.05, f4 + 0.15, uCt);
  float transit4 = smoothstep(0.0, 0.04, e4) * mix(1.0, keep4, smoothstep(0.9, 1.0, e4));
  float onward = mix(mix(transit2, transit3, step(0.0001, e3)), transit4, step(0.0001, e4));
  float handover = mix(1.0, onward, atCard);
  // Gentle per-particle shimmer, so the dotted name feels alive.
  float shimmer = 0.82 + 0.18 * sin(uTime * (1.5 + aRand * 2.0) + aRand * 80.0);
  vAlpha = ((0.6 + 0.4 * aRand) * shimmer + scan * 0.6 + edge * cc * 0.3) * max(uFade, spot) * handover * (1.0 + 0.35 * flight) * lateVis;
  vForce = scan * 0.5 * uScanGold;
}
`

const starVertex = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uSize;
uniform float uPixelRatio;
attribute vec3 aColor;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;
varying float vForce;
void main() {
  vec3 pos = position;
  pos.y += sin(uTime * 0.12 + aRand * 20.0) * 0.12;
  pos.y = mod(pos.y + uScroll + 10.0, 20.0) - 10.0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float big = step(0.985, aRand) * 3.5;
  gl_PointSize = uSize * uPixelRatio * (0.5 + aRand + big) / -mv.z;
  vColor = aColor;
  vAlpha = (0.4 + 0.6 * (0.5 + 0.5 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 90.0))) * (0.5 + 0.5 * aRand);
  vForce = 0.0;
}
`

// Large, softly glowing coloured orbs scattered behind the stars.
const orbVertex = /* glsl */ `
uniform float uTime;
uniform float uScroll;
uniform float uSize;
uniform float uPixelRatio;
attribute vec3 aColor;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec3 pos = position;
  pos.x += cos(uTime * 0.06 + aRand * 17.0) * 0.2;
  pos.y += sin(uTime * 0.08 + aRand * 30.0) * 0.2;
  pos.y = mod(pos.y + uScroll + 10.0, 20.0) - 10.0;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (2.5 + aRand * aRand * 9.0) / -mv.z;
  vColor = aColor;
  vAlpha = (0.55 + 0.45 * sin(uTime * (0.3 + aRand * 0.5) + aRand * 50.0)) * (0.45 + 0.45 * aRand);
}
`

const orbFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float glow = exp(-d * d * 18.0);
  float core = smoothstep(0.12, 0.0, d);
  gl_FragColor = vec4(vColor + core * 0.5, (glow * 0.55 + core * 0.6) * vAlpha);
}
`

// Shooting stars: a small pool of streaks, each a trail of points behind a moving head.
const STREAKS = 2
const TRAIL = 64
const streakVertex = /* glsl */ `
uniform float uSize;
uniform float uPixelRatio;
uniform vec3 uHead[${STREAKS}];
uniform vec3 uDir[${STREAKS}];
uniform float uLife[${STREAKS}];
attribute float aId;
attribute float aT;
varying vec3 vColor;
varying float vAlpha;
varying float vForce;
void main() {
  vec3 head = uHead[0];
  vec3 dir = uDir[0];
  float life = uLife[0];
  for (int i = 1; i < ${STREAKS}; i++) {
    if (float(i) == aId) {
      head = uHead[i];
      dir = uDir[i];
      life = uLife[i];
    }
  }
  vec3 pos = head - dir * aT * 1.8;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float k = 1.0 - aT;
  gl_PointSize = uSize * uPixelRatio * (0.4 + 1.1 * k * k) / -mv.z;
  vColor = mix(vec3(0.75, 0.85, 1.0), vec3(1.0), k);
  vAlpha = k * k * sin(clamp(life, 0.0, 1.0) * 3.14159) * 0.9;
  vForce = 0.0;
}
`

function useUniforms(extra) {
  const { gl } = useThree()
  return useMemo(
    () => ({
      uTime: { value: 0 },
      uSize: { value: 30 },
      uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) },
      uAccent: { value: new THREE.Color('#f5b544') },
      ...extra(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
}

const pointsMaterial = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }

// ── Name ─────────────────────────────────────────────────────────────
const smoothstepJS = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
// How far an element is still shown while its particles leave for the next station
// (1 → 0 at the start of the next leg; keep in sync with pre2/keep2/keep3 in the shader).
const stay = (next) => 1 - smoothstepJS(0, 0.05, next)

function NameField({ split, resolved, anchor, reduce, ndc, wide, onFormed, onSwept }) {
  const { viewport, gl } = useThree()
  const fade = useRef(1)
  const group = useRef()
  const mat = useRef()
  const mouse = useRef(new THREE.Vector2(99, 99))
  const t0 = useRef(0)
  const progress = useRef(reduce ? 1 : 0)
  const splitT = useRef(reduce && split ? 1 : 0)
  const formed = useRef(false)
  const travel = useRef(new Array(MAX_CARDS).fill(0))
  const tl = useRef(0) // timeline stage progress
  const sk = useRef(0) // skills stage progress
  const ct = useRef(0) // contact finale progress
  const tlMark = useRef('') // last --tl value written to the timeline
  const sweeps = useRef({ gold: null, white: null, done: false }) // start times of the two sweeps
  const spot = useRef({ k: 0, px: 0, py: 0, lx: 0, ly: 0, R: 1, Rl: 1, mask: '' })
  const hoverable = useMemo(() => window.matchMedia('(hover: hover) and (pointer: fine)').matches, [])

  const geometry = useMemo(() => {
    const { a, b, delay, count } = buildName(profile.name.toUpperCase().split(' '), wide ? 18000 : 8000)
    const start = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const cardSel = new Float32Array(count)
    const uv = new Float32Array(count * 2)
    const off = new Float32Array(count * 3)
    // Finale: each particle's point inside the Contact headline's highlighted word.
    const wordText = document.querySelector('.contact-title em')?.textContent?.trim() || 'intelligent'
    const wordPts = sampleWord(wordText)
    const word = new Float32Array(count * 2)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const R = 1.7 + (Math.random() - 0.5) * 0.18
      start.set([Math.cos(golden * i) * r * R, y * R, Math.sin(golden * i) * r * R], i * 3)
      rand[i] = Math.random()
      cardSel[i] = Math.random()
      // Where on its card this particle lands: 55% on the outline, the rest inside.
      let u
      let v
      if (Math.random() < 0.55) {
        const e = Math.random() * 4
        const t = Math.random()
        ;[u, v] = e < 1 ? [t, 0] : e < 2 ? [1, t] : e < 3 ? [t, 1] : [0, t]
      } else {
        u = Math.random()
        v = Math.random()
      }
      uv.set([u, v], i * 2)
      off.set([Math.random() * 2 - 1, Math.random(), Math.random() * 2 - 1], i * 3)
      if (wordPts.length) word.set(wordPts[i % wordPts.length], i * 2)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    g.setAttribute('aTarget', new THREE.BufferAttribute(b, 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1))
    g.setAttribute('aCardSel', new THREE.BufferAttribute(cardSel, 1))
    g.setAttribute('aUV', new THREE.BufferAttribute(uv, 2))
    g.setAttribute('aOff', new THREE.BufferAttribute(off, 3))
    g.setAttribute('aWord', new THREE.BufferAttribute(word, 2))
    return g
  }, [wide])
  useEffect(() => () => geometry.dispose(), [geometry])

  // Project cards start hidden only while this effect drives them (CSS hook).
  useEffect(() => {
    if (reduce) return
    const root = document.documentElement
    root.classList.add('can-assemble')
    return () => {
      root.classList.remove('can-assemble')
      document.querySelectorAll('#experiments .holo-card').forEach((el) => {
        el.style.opacity = ''
        el.style.filter = ''
      })
      document.querySelector('#acts .acts')?.style.removeProperty('--tl')
      document
        .querySelectorAll('#acts .act, #system .glass-panel, .contact-title em, #contact .contact-row .btn')
        .forEach((a) => a.style.removeProperty('--reveal'))
      if (anchor?.current) {
        anchor.current.style.opacity = ''
        anchor.current.style.webkitMaskImage = ''
        anchor.current.style.maskImage = ''
      }
    }
  }, [reduce, anchor])

  const uniforms = useUniforms(() => ({
    uProgress: { value: progress.current },
    uSplit: { value: 0 },
    uFade: { value: 1 },
    uMouse: { value: new THREE.Vector2(99, 99) },
    uDissolve: { value: 0 },
    uCount: { value: 0 },
    uRects: { value: Array.from({ length: MAX_CARDS }, () => new THREE.Vector4()) },
    uTravel: { value: new Array(MAX_CARDS).fill(0) },
    uLate: { value: new Array(MAX_CARDS).fill(0) },
    uGroupPos: { value: new THREE.Vector3() },
    uGroupScale: { value: 1 },
    uView: { value: new THREE.Vector2(1, 1) },
    uScanX: { value: 99 },
    uScanGold: { value: 1 },
    uTl: { value: 0 },
    uLine: { value: new THREE.Vector4() },
    uDots: { value: Array.from({ length: 4 }, () => new THREE.Vector2()) },
    uDotCount: { value: 0 },
    uDotR: { value: 0.05 },
    uActs: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    uSkT: { value: 0 },
    uSk: { value: Array.from({ length: MAX_PANELS }, () => new THREE.Vector4()) },
    uSkCum: { value: new Array(MAX_PANELS).fill(1) },
    uSkCount: { value: 0 },
    uCt: { value: 0 },
    uWord: { value: new THREE.Vector4() },
    uBtn: { value: [new THREE.Vector4(), new THREE.Vector4()] },
    uBtnCount: { value: 0 },
    uSpot: { value: new THREE.Vector4(0, 0, 1, 0) },
  }))

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    t0.current += dt
    const u = mat.current.uniforms
    u.uTime.value = state.clock.elapsedTime

    if (!reduce && t0.current > 0.5) progress.current = Math.min(1, progress.current + dt / 3.0)
    u.uProgress.value = progress.current
    if (!formed.current && progress.current >= 1) {
      formed.current = true
      if (!reduce) sweeps.current.gold = t0.current
      onFormed?.()
    }
    splitT.current = split ? (reduce ? 1 : Math.min(1, splitT.current + dt / 1.6)) : 0

    // Two light sweeps across the name (name space x: -5…5): a golden one as soon as it
    // has formed, and a white one once it has moved into place. After the white one the
    // hero hands over to the crisp name.
    const sw = sweeps.current
    let scanX = 99
    let scanGold = 1
    if (sw.gold !== null && t0.current - sw.gold < SWEEP_S) scanX = sweepX((t0.current - sw.gold) / SWEEP_S)
    // The white sweep starts during the last ~0.4s of the move, so the two overlap slightly.
    if (sw.white === null && formed.current && splitT.current >= 0.75 && !reduce) sw.white = t0.current
    if (sw.white !== null) {
      const k = (t0.current - sw.white) / SWEEP_S
      if (k < 1) {
        scanX = sweepX(k)
        scanGold = 0
      } else if (!sw.done) {
        sw.done = true
        onSwept?.()
      }
    }
    u.uScanX.value = scanX
    u.uScanGold.value = scanGold
    const e = ease(splitT.current)
    // On narrow screens the stacked layout is used from the start.
    u.uSplit.value = wide ? e : 1

    const L = layout(viewport, wide)
    const c = gl.domElement.getBoundingClientRect()
    // After the split the particles land exactly on the crisp DOM name (the anchor).
    let B = L.nameB
    const el = anchor?.current
    let nameRect = null
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && c.width > 0) {
        nameRect = r
        B = {
          x: ((r.left - c.left + r.width / 2) / c.width - 0.5) * viewport.width,
          y: -((r.top - c.top + r.height / 2) / c.height - 0.5) * viewport.height,
          s: ((r.width / c.width) * viewport.width) / TEXT_W,
        }
      }
    }
    // The canvas is fixed to the viewport, so the intro layout scrolls away with the hero.
    const scrollY = (window.scrollY / window.innerHeight) * viewport.height
    const s = L.nameA.s + (B.s - L.nameA.s) * e
    const x = L.nameA.x + (B.x - L.nameA.x) * e
    const y = L.nameA.y + scrollY + (B.y - L.nameA.y - scrollY) * e
    group.current.scale.setScalar(s)
    group.current.position.set(x, y, 0)
    u.uGroupPos.value.set(x, y, 0)
    u.uGroupScale.value = s
    u.uView.value.set(viewport.width, viewport.height)

    // ── Scroll journey (only once the crisp name has taken over) ──
    const journey = resolved && !reduce
    // Dissolve: 0 at the top, 1 after scrolling ~55% of a screen.
    const dissolve = journey ? smoothstepJS(0, window.innerHeight * 0.55, window.scrollY) : 0
    u.uDissolve.value = dissolve
    const appear = smoothstepJS(0, 0.12, dissolve)
    if (journey && el) el.style.opacity = (1 - appear).toFixed(3)

    const cards = document.querySelectorAll('#experiments .holo-card')
    const count = Math.min(cards.length, MAX_CARDS)
    const scrollPx = window.scrollY
    const first = count ? (cards[0].querySelector('.holo') || cards[0]).getBoundingClientRect() : null
    let cardsAt = 0 // scroll position (px) at which the last card has formed
    let cardsOff = 0 // scroll position (px) at which the cards start leaving (bottom edge at LEAVE_AT)
    // The station a leg leaves from must be complete; the flight lasts at least MIN_FLIGHT screens.
    const legFrom = (doneAt, leaveAt, arriveAt) => Math.max(doneAt, Math.min(leaveAt, arriveAt - c.height * MIN_FLIGHT))
    const legT = (from, at) => Math.min(1, Math.max(0, at > from + 1 ? (scrollPx - from) / (at - from) : scrollPx >= at ? 1 : 0))
    for (let i = 0; i < count; i++) {
      const card = cards[i]
      const r = (card.querySelector('.holo') || card).getBoundingClientRect()
      // Cards below the first row (the float animation moves cards a few px, hence the tolerance).
      u.uLate.value[i] = first && r.top > first.top + first.height / 2 ? 1 : 0
      // Travel: 0 at the top of the page, 1 when the card's centre reaches 55% of the screen.
      const remaining = r.top + r.height / 2 - c.height * 0.55
      cardsAt = Math.max(cardsAt, scrollPx + remaining)
      // The tour stops where the first card has formed (on phones the others form as they scroll in).
      if (i === 0) stationDone.experiments = scrollPx + remaining
      cardsOff = Math.max(cardsOff, scrollPx + r.bottom - c.height * LEAVE_AT)
      const goal = journey ? Math.min(1, scrollPx / Math.max(1, scrollPx + Math.max(0, remaining))) : 0
      // Momentum: the particles ease toward the scroll position instead of tracking it rigidly.
      travel.current[i] += (goal - travel.current[i]) * (1 - Math.exp(-dt * 5))
      if (Math.abs(goal - travel.current[i]) < 0.0005) travel.current[i] = goal
      u.uTravel.value[i] = travel.current[i]
      u.uRects.value[i].set(
        ((r.left + r.width / 2 - c.left) / c.width - 0.5) * viewport.width,
        -((r.top + r.height / 2 - c.top) / c.height - 0.5) * viewport.height,
        (r.width / c.width) * viewport.width,
        (r.height / c.height) * viewport.height,
      )
      // The glass card fades in once its particles have landed, and out as they leave for the
      // timeline (tl from the previous frame).
      const k = journey ? smoothstepJS(0.93, 1, travel.current[i]) * stay(tl.current) : 1
      const o = k.toFixed(3)
      if (card.style.opacity !== o) {
        card.style.opacity = o
        card.style.filter = k >= 1 ? 'none' : `blur(${((1 - k) * 8).toFixed(1)}px)`
      }
    }
    u.uCount.value = journey ? count : 0

    // ── Station 3: the career timeline (line + act dots) ──
    const toWX = (px) => ((px - c.left) / c.width - 0.5) * viewport.width
    const toWY = (py) => -((py - c.top) / c.height - 0.5) * viewport.height
    const timeline = document.querySelector('#acts .acts')
    let tlGoal = 0
    let tlAt = 0 // scroll position (px) at which the timeline is fully drawn
    let tlOff = 0 // scroll position (px) at which the timeline starts leaving
    if (timeline && count) {
      const ar = timeline.getBoundingClientRect()
      const items = [...timeline.children].slice(0, 4).map((a) => a.getBoundingClientRect())
      // Desktop: a horizontal line along the top. Phones: a vertical line down the left side.
      const vertical = items.length > 1 && Math.abs(items[1].left - items[0].left) < 2
      if (vertical) u.uLine.value.set(toWX(ar.left), toWY(ar.top), toWX(ar.left), toWY(ar.bottom))
      else u.uLine.value.set(toWX(ar.left), toWY(ar.top), toWX(ar.right), toWY(ar.top))
      // Dot centres, matching .act::before (9px dots; see styles.css).
      items.forEach((a, i) => {
        if (vertical) u.uDots.value[i].set(toWX(ar.left), toWY(a.top + 8.5))
        else u.uDots.value[i].set(toWX(a.left + 4.5), toWY(ar.top - 0.5))
      })
      u.uDotCount.value = items.length
      // The act glass cards, traced by half of the particles that reach the timeline.
      ;[...timeline.children].slice(0, 4).forEach((act, i) => {
        const pr = (act.querySelector('.act-panel') || act).getBoundingClientRect()
        tlOff = Math.max(tlOff, scrollPx + pr.bottom - c.height * LEAVE_AT)
        u.uActs.value[i].set(
          toWX(pr.left + pr.width / 2),
          toWY(pr.top + pr.height / 2),
          (pr.width / c.width) * viewport.width,
          (pr.height / c.height) * viewport.height,
        )
      })
      u.uDotR.value = (7 / c.height) * viewport.height
      // 0 while the cards are still being read (until they scroll up to LEAVE_AT), 1 when the
      // timeline is ~60% down the screen.
      tlAt = scrollPx + ar.top + (vertical ? Math.min(ar.height, c.height * 0.5) / 2 : 0) - c.height * 0.6
      if (journey) tlGoal = legT(legFrom(cardsAt, cardsOff, tlAt), tlAt)
      stationDone.acts = tlAt
    }
    // Slower momentum than the first river: by now the visitor is reading.
    tl.current += (tlGoal - tl.current) * (1 - Math.exp(-dt * 3.5))
    if (Math.abs(tlGoal - tl.current) < 0.0005) tl.current = tlGoal
    u.uTl.value = tl.current
    // The real line and dots appear as the particles arrive (CSS reads --tl), and each act's
    // text fades in when the particles reach its dot (--reveal), in drawing order. All of it fades
    // out again as the particles leave for the skill panels (sk from the previous frame); Tick
    // sinks back into the line with it.
    if (timeline) {
      const on = journey && count
      const out = stay(sk.current)
      const mark = on ? (smoothstepJS(0.85, 1, tl.current) * out).toFixed(3) : ''
      if (mark !== tlMark.current) {
        if (mark) timeline.style.setProperty('--tl', mark)
        else timeline.style.removeProperty('--tl')
        tlMark.current = mark
      }
      const L4 = u.uLine.value
      const len = Math.hypot(L4.z - L4.x, L4.w - L4.y) || 1
      ;[...timeline.children].forEach((act, i) => {
        let v = ''
        if (on && i < 4) {
          // How far along the line this act's dot is (0 = start), as the shader sees it.
          const d = u.uDots.value[i]
          const h = Math.min(1, Math.hypot(d.x - L4.x, d.y - L4.y) / len)
          // The last particle for this act lands at tl = 0.55 + 0.3h + 0.1 (see leg 2 in the
          // shader); the card only fades in after that, so it appears once its outline is done.
          // (Keep in sync with f2 in the shader.)
          const from = Math.min(0.85, 0.65 + 0.3 * h)
          v = (smoothstepJS(from, Math.min(1, from + 0.15), tl.current) * out).toFixed(3)
        }
        if (act.style.getPropertyValue('--reveal') !== v) {
          if (v) act.style.setProperty('--reveal', v)
          else act.style.removeProperty('--reveal')
        }
      })
    }

    // ── Station 4: the skill panels (outlines traced one after another) ──
    const panels = [...document.querySelectorAll('#system .glass-panel')].slice(0, MAX_PANELS)
    let skGoal = 0
    let skAt = 0 // scroll position (px) at which the skill panels are traced
    let skOff = 0 // scroll position (px) at which the panels start leaving
    if (panels.length && timeline && count) {
      const rects = panels.map((p) => p.getBoundingClientRect())
      skOff = Math.max(...rects.map((pr) => scrollPx + pr.bottom - c.height * LEAVE_AT))
      const per = rects.map((pr) => 2 * (pr.width + pr.height))
      const total = per.reduce((a, b) => a + b, 0) || 1
      let cum = 0
      rects.forEach((pr, i) => {
        u.uSk.value[i].set(
          toWX(pr.left + pr.width / 2),
          toWY(pr.top + pr.height / 2),
          (pr.width / c.width) * viewport.width,
          (pr.height / c.height) * viewport.height,
        )
        cum += per[i] / total
        u.uSkCum.value[i] = cum
      })
      // 0 while the timeline is still being read, 1 when the first (headline) panel is ~60% down
      // the screen.
      skAt = scrollPx + rects[0].top + Math.min(rects[0].height, c.height * 0.3) - c.height * 0.6
      if (journey) skGoal = legT(legFrom(tlAt, tlOff, skAt), skAt)
      stationDone.system = skAt
    }
    u.uSkCount.value = journey && count ? panels.length : 0
    sk.current += (skGoal - sk.current) * (1 - Math.exp(-dt * 3.5))
    if (Math.abs(skGoal - sk.current) < 0.0005) sk.current = skGoal
    u.uSkT.value = sk.current
    // Each panel fades in once its outline is traced (CSS reads --reveal; unset = visible), and
    // out as the particles leave for Contact (ct from the previous frame).
    panels.forEach((p, i) => {
      let v = ''
      if (journey && count) {
        // The last particle for panel i lands at sk = 0.4·i/n + 0.4 + 0.1 (see leg 3 in the
        // shader); the panel only fades in after that. (Keep in sync with f3 in the shader.)
        const from = Math.min(0.85, 0.5 + (0.4 * i) / panels.length)
        v = (smoothstepJS(from, Math.min(1, from + 0.15), sk.current) * stay(ct.current)).toFixed(3)
      }
      if (p.style.getPropertyValue('--reveal') !== v) {
        if (v) p.style.setProperty('--reveal', v)
        else p.style.removeProperty('--reveal')
      }
    })

    // ── Station 5 (finale): Contact — the highlighted word, then the two buttons ──
    const wordEl = document.querySelector('.contact-title em')
    const btns = [...document.querySelectorAll('#contact .contact-row .btn')].slice(0, 2)
    let ctGoal = 0
    if (wordEl && panels.length && count) {
      const wr = wordEl.getBoundingClientRect()
      u.uWord.value.set(toWX(wr.left), toWY(wr.top), (wr.width / c.width) * viewport.width, (wr.height / c.height) * viewport.height)
      btns.forEach((b, i) => {
        const br = b.getBoundingClientRect()
        u.uBtn.value[i].set(
          toWX(br.left + br.width / 2),
          toWY(br.top + br.height / 2),
          (br.width / c.width) * viewport.width,
          (br.height / c.height) * viewport.height,
        )
      })
      // 0 while the skill panels are still being read, 1 when the word is ~55% down the screen —
      // capped at the bottom of the page, since Contact is last and may never scroll that high.
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const ctAt = Math.min(scrollPx + wr.top + wr.height / 2 - c.height * 0.55, maxScroll - 2)
      if (journey) ctGoal = legT(legFrom(skAt, skOff, ctAt), ctAt)
      stationDone.contact = ctAt
    }
    u.uWord.value.z = journey && count && wordEl ? u.uWord.value.z : 0
    u.uBtnCount.value = journey && count ? btns.length : 0
    ct.current += (ctGoal - ct.current) * (1 - Math.exp(-dt * 3.5))
    if (Math.abs(ctGoal - ct.current) < 0.0005) ct.current = ctGoal
    u.uCt.value = ct.current
    // The crisp word and the buttons appear once their particles have landed (word lands by
    // ct ≈ 0.6, buttons by ≈ 0.8; keep in sync with f4 in the shader).
    const reveal = (el, from) => {
      const v = journey && count ? smoothstepJS(from, from + 0.15, ct.current).toFixed(3) : ''
      if (el.style.getPropertyValue('--reveal') !== v) {
        if (v) el.style.setProperty('--reveal', v)
        else el.style.removeProperty('--reveal')
      }
    }
    if (wordEl) reveal(wordEl, 0.62)
    btns.forEach((b) => reveal(b, 0.82))

    // Intro hand-over: once the crisp name shows, the particles hide until scrolling begins.
    // Slow cross-fade (matches the .hero-name opacity transition).
    fade.current = resolved ? (reduce ? 0 : Math.max(0, fade.current - dt / 1.6)) : 1
    u.uFade.value = Math.max(fade.current, appear)

    if (ndc.current) {
      const tx = ((ndc.current.x * viewport.width) / 2 - x) / s
      const ty = ((ndc.current.y * viewport.height) / 2 - y) / s
      if (mouse.current.x > 50) mouse.current.set(tx, ty)
      mouse.current.set(smooth(mouse.current.x, tx, dt, 10), smooth(mouse.current.y, ty, dt, 10))
    } else mouse.current.set(99, 99)
    u.uMouse.value.copy(mouse.current)

    // ── Hover spotlight: around the cursor the crisp name opens up into white dots ──
    // The crisp name gets a radial mask hole and the particles show in exactly that circle.
    const sp = spot.current
    let want = 0
    if (hoverable && journey && nameRect && ndc.current && dissolve < 0.02 && mouse.current.x < 50) {
      // The same (smoothed) point the particles use, back in CSS pixels.
      const px = ((mouse.current.x * s + x) / viewport.width + 0.5) * c.width + c.left
      const py = (0.5 - (mouse.current.y * s + y) / viewport.height) * c.height + c.top
      const R = nameRect.height * 0.3 // about one letter tall
      const m = R * 0.5
      if (px > nameRect.left - m && px < nameRect.right + m && py > nameRect.top - m && py < nameRect.bottom + m) {
        want = 1
        sp.px = px - nameRect.left
        sp.py = py - nameRect.top
        sp.lx = mouse.current.x
        sp.ly = mouse.current.y
        sp.R = R
        sp.Rl = (R * viewport.width) / c.width / s
      }
    }
    sp.k = smooth(sp.k, want, dt, 12)
    if (sp.k < 0.002) sp.k = 0
    u.uSpot.value.set(sp.lx, sp.ly, sp.Rl, sp.k)
    const mask =
      sp.k > 0
        ? `radial-gradient(circle ${sp.R.toFixed(1)}px at ${sp.px.toFixed(1)}px ${sp.py.toFixed(1)}px, rgba(0,0,0,${(1 - sp.k).toFixed(3)}) 55%, #000 100%)`
        : ''
    if (el && mask !== sp.mask) {
      el.style.webkitMaskImage = mask
      el.style.maskImage = mask
      sp.mask = mask
    }
    group.current.visible = u.uFade.value > 0.001 || sp.k > 0
  })

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial ref={mat} vertexShader={nameVertex} fragmentShader={fragment} uniforms={uniforms} {...pointsMaterial} />
      </points>
    </group>
  )
}

// ── Stars ────────────────────────────────────────────────────────────
function StarField({ ndc, wide }) {
  const group = useRef()
  const mat = useRef()
  const geometry = useMemo(() => {
    const count = wide ? 26000 : 9000
    const pos = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const cols = STAR_COLORS.map((h) => new THREE.Color(h))
    const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())
    for (let i = 0; i < count; i++) {
      if (i % 5 < 3) {
        // 60%: a dense, slightly tilted galaxy band across the middle.
        const x = (Math.random() - 0.5) * 36
        pos.set([x, gauss() * 0.9 + x * 0.06 - 0.3, -9 + Math.random() * 9], i * 3)
      } else {
        pos.set([(Math.random() - 0.5) * 36, (Math.random() - 0.5) * 20, -10 + Math.random() * 11], i * 3)
      }
      rand[i] = Math.random()
      const c = Math.random() < 0.45 ? cols[0] : cols[1 + ((Math.random() * (cols.length - 1)) | 0)]
      color.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    return g
  }, [wide])
  useEffect(() => () => geometry.dispose(), [geometry])
  const uniforms = useUniforms(() => ({ uSize: { value: 26 }, uScroll: { value: 0 } }))

  const orbMat = useRef()
  const orbGeometry = useMemo(() => {
    const count = wide ? 160 : 60
    const pos = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const cols = ORB_COLORS.map((h) => new THREE.Color(h))
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 36, (Math.random() - 0.5) * 20, -10 + Math.random() * 7], i * 3)
      rand[i] = Math.random()
      const c = cols[(Math.random() * cols.length) | 0]
      color.set([c.r, c.g, c.b], i * 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aColor', new THREE.BufferAttribute(color, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    return g
  }, [wide])
  useEffect(() => () => orbGeometry.dispose(), [orbGeometry])
  const orbUniforms = useUniforms(() => ({ uSize: { value: 26 }, uScroll: { value: 0 } }))
  const { viewport } = useThree()

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    const scroll = (window.scrollY / window.innerHeight) * viewport.height
    mat.current.uniforms.uTime.value = state.clock.elapsedTime
    mat.current.uniforms.uScroll.value = scroll * 0.35
    orbMat.current.uniforms.uTime.value = state.clock.elapsedTime
    orbMat.current.uniforms.uScroll.value = scroll * 0.25
    const px = ndc.current ? ndc.current.x : 0
    const py = ndc.current ? ndc.current.y : 0
    group.current.rotation.y = smooth(group.current.rotation.y, px * 0.06, dt, 2)
    group.current.rotation.x = smooth(group.current.rotation.x, -py * 0.04, dt, 2)
  })

  return (
    <group ref={group}>
      <points geometry={geometry} frustumCulled={false}>
        <shaderMaterial ref={mat} vertexShader={starVertex} fragmentShader={fragment} uniforms={uniforms} {...pointsMaterial} />
      </points>
      <points geometry={orbGeometry} frustumCulled={false}>
        <shaderMaterial ref={orbMat} vertexShader={orbVertex} fragmentShader={orbFragment} uniforms={orbUniforms} {...pointsMaterial} />
      </points>
    </group>
  )
}

// ── Shooting stars ───────────────────────────────────────────────────
function ShootingStars() {
  const mat = useRef()
  const { viewport } = useThree()
  const streaks = useRef(
    Array.from({ length: STREAKS }, (_, i) => ({ life: 1, wait: 3 + i * 4 + Math.random() * 4, dur: 1, dist: 1, start: new THREE.Vector3() })),
  )
  const geometry = useMemo(() => {
    const n = STREAKS * TRAIL
    const id = new Float32Array(n)
    const t = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      id[i] = Math.floor(i / TRAIL)
      t[i] = (i % TRAIL) / (TRAIL - 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3))
    g.setAttribute('aId', new THREE.BufferAttribute(id, 1))
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const uniforms = useUniforms(() => ({
    uSize: { value: 26 },
    uHead: { value: Array.from({ length: STREAKS }, () => new THREE.Vector3()) },
    uDir: { value: Array.from({ length: STREAKS }, () => new THREE.Vector3(1, 0, 0)) },
    uLife: { value: new Array(STREAKS).fill(1) },
  }))

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    const u = mat.current.uniforms
    // Streaks live at z = -3, i.e. 13 units from the camera instead of 10.
    const halfW = (viewport.width / 2) * 1.3
    const halfH = (viewport.height / 2) * 1.3
    streaks.current.forEach((s, i) => {
      if (s.life >= 1) {
        s.wait -= dt
        if (s.wait > 0) return
        // Spawn: upper part of the screen, falling diagonally left or right.
        const side = Math.random() < 0.5 ? -1 : 1
        const angle = ((20 + Math.random() * 25) * Math.PI) / 180
        s.start.set((Math.random() * 1.8 - 0.9) * halfW, (0.1 + Math.random() * 0.85) * halfH, -3)
        u.uDir.value[i].set(side * Math.cos(angle), -Math.sin(angle), 0)
        s.dist = 3 + Math.random() * 3
        s.dur = 0.6 + Math.random() * 0.4
        s.wait = 5 + Math.random() * 5
        s.life = 0
      }
      s.life = Math.min(1, s.life + dt / s.dur)
      u.uHead.value[i].copy(s.start).addScaledVector(u.uDir.value[i], s.dist * s.life)
      u.uLife.value[i] = s.life
    })
  })

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={streakVertex} fragmentShader={fragment} uniforms={uniforms} {...pointsMaterial} />
    </points>
  )
}

export default function ParticleScene({ active, split, resolved, nameAnchor, reduce, wide, onFormed, onSwept }) {
  const ndc = usePointer()
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 35 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
    >
      <StarField ndc={ndc} wide={wide} />
      {reduce ? null : <ShootingStars />}
      <NameField
        key={`name-${wide}`}
        split={split}
        resolved={resolved}
        anchor={nameAnchor}
        reduce={reduce}
        ndc={ndc}
        wide={wide}
        onFormed={onFormed}
        onSwept={onSwept}
      />
    </Canvas>
  )
}
