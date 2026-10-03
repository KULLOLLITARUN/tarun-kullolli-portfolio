import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { profile } from '../data.js'
import { faceState } from '../chat/faceState.js'

const TEXT_W = 10 // name block width in "name space" units
const STAR_COLORS = ['#f4f4f5', '#a78bfa', '#60a5fa', '#f5b544', '#f472b6', '#38bdf8', '#fb7185']
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
    }, 3)
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
uniform vec3 uGroupPos;
uniform float uGroupScale;
uniform vec2 uView;
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
  for (int i = 0; i < ${MAX_CARDS}; i++) {
    if (float(i) == ci) {
      r = uRects[i];
      T = uTravel[i];
    }
  }
  // Each particle lags a little behind its card's progress, so the stream stretches like a comet tail.
  float tp = clamp((T - aRand * 0.25) / 0.75, 0.0, 1.0);
  float e = tp * tp * (3.0 - 2.0 * tp);
  vec3 nameW = pos * uGroupScale + uGroupPos;
  vec3 cardW = vec3(r.x + (aUV.x - 0.5) * r.z, r.y - (aUV.y - 0.5) * r.w, 0.0);
  // Curved path: bows out toward one side (by varying amounts) and back into the card.
  float side = aOff.x < 0.0 ? -1.0 : 1.0;
  vec3 ctrl = vec3(mix(cardW.x, side * uView.x * 0.3, abs(aOff.x)), (nameW.y + cardW.y) * 0.5, aOff.z * 1.2);
  float it = 1.0 - e;
  vec3 pathW = it * it * nameW + 2.0 * it * e * ctrl + e * e * cardW;
  // Flowing turbulence mid-flight, calm at both ends.
  float fl = sin(e * 3.14159);
  pathW += vec3(
    sin(pathW.y * 1.3 + uTime * 0.8 + aRand * 6.28),
    cos(pathW.x * 1.1 - uTime * 0.7 + aRand * 3.0),
    sin(uTime * 0.5 + aRand * 9.0)
  ) * 0.28 * fl;
  if (uCount > 0.5) pos = toLocal(pathW);
  float dd = e;
  float cc = e;
  float cp = T;

  // Cursor push only while the particles are still the name.
  vec2 d = pos.xy - uMouse;
  float dist = length(d);
  float f = (1.0 - smoothstep(0.0, 1.2, dist)) * (1.0 - dd);
  pos.xy += (d / max(dist, 0.001)) * f * 0.5;
  pos.z += f * 0.8;

  // A slow scan line sweeps across the settled name.
  float scan = exp(-pow((target.x - (mod(uTime * 2.2, 22.0) - 11.0)) * 2.2, 2.0)) * p * (1.0 - dd);

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float edge = step(min(min(aUV.x, 1.0 - aUV.x), min(aUV.y, 1.0 - aUV.y)), 0.001);
  gl_PointSize = uSize * uPixelRatio * (0.55 + aRand * 0.6 + edge * cc * 0.35) * (1.0 + scan * 0.6) / -mv.z;
  vec3 col = step(0.97, aRand) > 0.5 ? vec3(0.96, 0.71, 0.27) : vec3(0.96);
  // Card outlines glow icy blue as they lock into place.
  vColor = mix(col, vec3(0.62, 0.86, 1.0), edge * cc * 0.85);
  // Particles hand over to the glass card once it has fully formed.
  float handover = 1.0 - smoothstep(0.96, 1.0, cp) * step(0.5, uCount);
  vAlpha = ((0.6 + 0.4 * aRand) + scan * 0.6 + edge * cc * 0.3) * uFade * handover;
  vForce = f + scan * 0.5;
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

function NameField({ split, resolved, anchor, reduce, ndc, wide, onFormed }) {
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

  const geometry = useMemo(() => {
    const { a, b, delay, count } = buildName(profile.name.toUpperCase().split(' '), wide ? 13000 : 6000)
    const start = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const cardSel = new Float32Array(count)
    const uv = new Float32Array(count * 2)
    const off = new Float32Array(count * 3)
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
      if (anchor?.current) anchor.current.style.opacity = ''
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
    uGroupPos: { value: new THREE.Vector3() },
    uGroupScale: { value: 1 },
    uView: { value: new THREE.Vector2(1, 1) },
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
      onFormed?.()
    }
    splitT.current = split ? (reduce ? 1 : Math.min(1, splitT.current + dt / 1.6)) : 0
    const e = ease(splitT.current)
    // On narrow screens the stacked layout is used from the start.
    u.uSplit.value = wide ? e : 1

    const L = layout(viewport, wide)
    const c = gl.domElement.getBoundingClientRect()
    // After the split the particles land exactly on the crisp DOM name (the anchor).
    let B = L.nameB
    const el = anchor?.current
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width > 0 && c.width > 0) {
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
    for (let i = 0; i < count; i++) {
      const card = cards[i]
      const r = (card.querySelector('.holo') || card).getBoundingClientRect()
      // Travel: 0 at the top of the page, 1 when the card's centre reaches 55% of the screen.
      const remaining = r.top + r.height / 2 - c.height * 0.55
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
      // The glass card fades in once its particles have landed.
      const k = journey ? smoothstepJS(0.93, 1, travel.current[i]) : 1
      const o = k.toFixed(3)
      if (card.style.opacity !== o) {
        card.style.opacity = o
        card.style.filter = k >= 1 ? 'none' : `blur(${((1 - k) * 8).toFixed(1)}px)`
      }
    }
    u.uCount.value = journey ? count : 0

    // Intro hand-over: once the crisp name shows, the particles hide until scrolling begins.
    fade.current = resolved ? (reduce ? 0 : Math.max(0, fade.current - dt / 0.9)) : 1
    u.uFade.value = Math.max(fade.current, appear)
    group.current.visible = u.uFade.value > 0.001

    if (ndc.current) {
      const tx = ((ndc.current.x * viewport.width) / 2 - x) / s
      const ty = ((ndc.current.y * viewport.height) / 2 - y) / s
      if (mouse.current.x > 50) mouse.current.set(tx, ty)
      mouse.current.set(smooth(mouse.current.x, tx, dt, 10), smooth(mouse.current.y, ty, dt, 10))
    } else mouse.current.set(99, 99)
    u.uMouse.value.copy(mouse.current)
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
  const { viewport } = useThree()

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    mat.current.uniforms.uTime.value = state.clock.elapsedTime
    mat.current.uniforms.uScroll.value = (window.scrollY / window.innerHeight) * viewport.height * 0.35
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
    </group>
  )
}

export default function ParticleScene({ active, split, resolved, nameAnchor, reduce, wide, onFormed }) {
  const ndc = usePointer()
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 35 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
    >
      <StarField ndc={ndc} wide={wide} />
      <NameField key={`name-${wide}`} split={split} resolved={resolved} anchor={nameAnchor} reduce={reduce} ndc={ndc} wide={wide} onFormed={onFormed} />
    </Canvas>
  )
}
