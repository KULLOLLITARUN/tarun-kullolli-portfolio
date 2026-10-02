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

const nameVertex = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uSplit;
uniform vec2 uMouse;
uniform float uSize;
uniform float uPixelRatio;
attribute vec3 aTarget;
attribute vec3 aStart;
attribute float aRand;
attribute float aDelay;
varying vec3 vColor;
varying float vAlpha;
varying float vForce;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
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

  vec2 d = pos.xy - uMouse;
  float dist = length(d);
  float f = 1.0 - smoothstep(0.0, 1.2, dist);
  pos.xy += (d / max(dist, 0.001)) * f * 0.5;
  pos.z += f * 0.8;

  // A slow scan line sweeps across the settled name.
  float scan = exp(-pow((target.x - (mod(uTime * 2.2, 22.0) - 11.0)) * 2.2, 2.0)) * p;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPixelRatio * (0.55 + aRand * 0.6) * (1.0 + scan * 0.6) / -mv.z;
  vColor = step(0.97, aRand) > 0.5 ? vec3(0.96, 0.71, 0.27) : vec3(0.96);
  vAlpha = (0.6 + 0.4 * aRand) + scan * 0.6;
  vForce = f + scan * 0.5;
}
`

const starVertex = /* glsl */ `
uniform float uTime;
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
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float big = step(0.985, aRand) * 3.5;
  gl_PointSize = uSize * uPixelRatio * (0.5 + aRand + big) / -mv.z;
  vColor = aColor;
  vAlpha = (0.25 + 0.75 * (0.5 + 0.5 * sin(uTime * (0.6 + aRand * 1.8) + aRand * 90.0))) * (0.35 + 0.65 * aRand);
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
function NameField({ split, reduce, ndc, wide, onFormed }) {
  const { viewport } = useThree()
  const group = useRef()
  const mat = useRef()
  const mouse = useRef(new THREE.Vector2(99, 99))
  const t0 = useRef(0)
  const progress = useRef(reduce ? 1 : 0)
  const splitT = useRef(reduce && split ? 1 : 0)
  const formed = useRef(false)

  const geometry = useMemo(() => {
    const { a, b, delay, count } = buildName(profile.name.toUpperCase().split(' '), wide ? 13000 : 6000)
    const start = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2
      const r = Math.sqrt(1 - y * y)
      const R = 1.7 + (Math.random() - 0.5) * 0.18
      start.set([Math.cos(golden * i) * r * R, y * R, Math.sin(golden * i) * r * R], i * 3)
      rand[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(a, 3))
    g.setAttribute('aTarget', new THREE.BufferAttribute(b, 3))
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3))
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1))
    g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1))
    return g
  }, [wide])
  useEffect(() => () => geometry.dispose(), [geometry])

  const uniforms = useUniforms(() => ({
    uProgress: { value: progress.current },
    uSplit: { value: 0 },
    uMouse: { value: new THREE.Vector2(99, 99) },
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
    const s = L.nameA.s + (L.nameB.s - L.nameA.s) * e
    const x = L.nameA.x + (L.nameB.x - L.nameA.x) * e
    const y = L.nameA.y + (L.nameB.y - L.nameA.y) * e
    group.current.scale.setScalar(s)
    group.current.position.set(x, y, 0)

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
    const count = wide ? 3200 : 1400
    const pos = new Float32Array(count * 3)
    const rand = new Float32Array(count)
    const color = new Float32Array(count * 3)
    const cols = STAR_COLORS.map((h) => new THREE.Color(h))
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 34, (Math.random() - 0.5) * 18, -10 + Math.random() * 11], i * 3)
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
  const uniforms = useUniforms(() => ({}))

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)
    mat.current.uniforms.uTime.value = state.clock.elapsedTime
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

export default function ParticleScene({ active, split, reduce, wide, onFormed }) {
  const ndc = usePointer()
  return (
    <Canvas
      camera={{ position: [0, 0, 10], fov: 35 }}
      dpr={[1, 1.75]}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      frameloop={active ? 'always' : 'never'}
    >
      <StarField ndc={ndc} wide={wide} />
      <NameField key={`name-${wide}`} split={split} reduce={reduce} ndc={ndc} wide={wide} onFormed={onFormed} />
    </Canvas>
  )
}
