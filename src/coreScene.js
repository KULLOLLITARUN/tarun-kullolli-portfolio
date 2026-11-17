import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { CORE_STATES } from './coreState.js'

// The AI "core": a see-through golden hologram made of thousands of glowing circuit dashes,
// streak particles, spokes and rings around a bright hub. It is original artwork in the spirit
// of sci-fi holograms. `createCore` mounts it in a container and returns { setActive, dispose }.
// The canvas is added as light over whatever is behind it (CSS mix-blend-mode: screen), so
// the page's own background shows through.

const rnd = (a, b) => a + Math.random() * (b - a)
const TAU = Math.PI * 2
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const PAL = [[1.0, 0.3, 0.0], [1.0, 0.54, 0.02], [1.0, 0.74, 0.04]] // deeper, main and lighter tones
const PALE = [1.0, 0.55, 0.06]
const WHITE_HOT = [1.0, 1.0, 1.0] // lands on the theme's palest tone: the oversized sparks

// Tweak the look here. Colours come from the page theme (the --orb token), so only the authored
// heat palette above lives in code: its "heat" picks where a piece sits between the theme's tones.
export const ORB_CONFIG = {
  segmentCount: 22000, // candidate fragments over all shells; ~45% are culled by noise (60% of this on small screens)
  segmentLength: [0.012, 0.035], // fragment length as a fraction of the sphere's radius
  voidEdge: [0.42, 0.54], // noise range where pieces fade from culled to kept: raise it for more voids
  shellCount: 7, // nested spherical shells, plus a share of traces inside the ball
  innerShare: 0.07, // fraction of segmentCount placed inside the volume instead of on a shell
  dustCount: 2400, // faint veil particles
  sparkCount: 14, // oversized white-hot sparks in total
  ribbonCount: 4, // Lissajous ribbons swirling around the core
  rotationSpeed: 1, // multiplies the spin of every shell (0 = still)
  bloomStrength: 0.18, // resting glow; talking, alarm and anger add to it
}
// Fewer pieces on small windows and 4-thread CPUs (the hero already skips the orb on weaker ones).
const lowEnd = innerWidth < 1100 || (navigator.hardwareConcurrency || 8) <= 4

// Each piece is authored in warm orange tones; its "heat" (green over red) picks where it sits
// between the theme's deep, main and pale colours, so the whole orb re-colours with the theme.
// The direction pieces leave in as the orb scrolls away (down and a little right, like the name dust).
const STREAM_GLSL = /* glsl */ `
  const vec2 STREAM = vec2(0.45, -1.4);
`
const THEME_GLSL = /* glsl */ `
  uniform vec3 uColA; uniform vec3 uColB; uniform vec3 uColC;
  vec3 themeColor(vec3 c, float red) {
    float br = max(c.r, 0.001);
    float h = clamp((c.g / br - 0.2) / 0.5, 0.0, 1.0);
    vec3 t = h < 0.7 ? mix(uColB, uColA, h / 0.7) : mix(uColA, uColC, (h - 0.7) / 0.3);
    vec3 hot = vec3(1.0, 0.2, 0.12) * (0.65 + 0.35 * h);
    return mix(t, hot, red) * br;
  }`

// The theme's accent colour (styles.css tokens, set by theme.js) as three tones: deep, main, pale.
function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}
function themeTones() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--orb-rgb').match(/\d+/g)
  const [r, g, b] = (v && v.length >= 3 ? v.slice(0, 3).map(Number) : [245, 181, 68]).map((x) => x / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d > 0) {
    if (max === r) h = ((g - b) / d + 6) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  const acc = [r, g, b]
  // A grey (d = 0) has no hue, so it is neither. The band edges are hard on purpose: no theme sits near them.
  const warm = d > 0 && (h < 0.07 || h > 0.94), cool = d > 0 && h > 0.55 && h < 0.94
  const mixTo = (a, c, t) => a.map((x, i) => x + (c[i] - x) * t)
  return {
    // Near red (rose, coral) the same saturation turns harsh crimson, so ease it off there. Blue, violet and
    // pink look dark and neon at the warm-hue values, so lift them and mute the saturation.
    deep: hslToRgb((h + 1 - 0.03) % 1, warm ? 0.72 : cool ? 0.5 : 0.9, cool ? 0.58 : 0.42),
    main: mixTo(acc, hslToRgb(h, cool ? 0.6 : 0.9, 0.5), 0.5),
    pale: mixTo(acc, [1, 1, 1], 0.3),
  }
}

const DASH_VERT = /* glsl */ `
  ${STREAM_GLSL}
  attribute vec3 aStart; attribute vec3 aEnd; attribute vec2 aCorner;
  attribute float aSeed; attribute vec3 aColor; attribute float aSmear; attribute float aWidth; attribute vec3 aScatter;
  uniform vec2 uRes; uniform float uTime; uniform float uSmear; uniform float uJitter; uniform float uAssemble;
  uniform float uScroll; uniform float uTour; uniform vec3 uTourPos; uniform vec3 uOrbC;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    // Intro: each piece starts far off to the left (where the name was) and flies in at its own time.
    float arrive = clamp(uAssemble * 1.7 - fract(aSeed * 5.31) * 0.7, 0.0, 1.0);
    arrive = arrive * arrive * (3.0 - 2.0 * arrive);
    vec3 off = aScatter * (1.0 - arrive);
    // Scrolling away: each piece peels off in its own time and drifts down into the star field.
    float away = clamp(uScroll * 1.7 - fract(aSeed * 7.71) * 0.7, 0.0, 1.0);
    away = away * away * (3.0 - 2.0 * away);
    // One shared stream (down and a little to the right), like the name dust, with only a small spread.
    vec3 drift = vec3(STREAM.x + aScatter.y * 0.35, STREAM.y - abs(aScatter.x) * 0.35, aScatter.z * 0.4) * away;
    vec3 e = aStart + (aEnd - aStart) * (1.0 + uSmear * aSmear + (1.0 - arrive) * 3.5 + away * 1.2);
    // Tour: each piece flies to the guide Kairo's position and bunches up there, then fades as the
    // real Kairo appears; at the end of the tour the same thing runs backwards.
    float tour = clamp(uTour * 1.6 - fract(aSeed * 4.13) * 0.6, 0.0, 1.0);
    tour = tour * tour * (3.0 - 2.0 * tour);
    vec3 vsA = (modelViewMatrix * vec4(aStart, 1.0)).xyz + off + drift;
    vec3 vsE = (modelViewMatrix * vec4(e, 1.0)).xyz + off + drift;
    // Streaks turn to point along the stream as they leave, keeping their length.
    vec3 flowDir = normalize(vec3(STREAM, 0.0));
    vec3 d0 = vsE - vsA;
    vsE = vsA + mix(d0, flowDir * length(d0), away * 0.85);
    vsA = mix(vsA, uTourPos + (vsA - uOrbC) * 0.1, tour);
    vsE = mix(vsE, uTourPos + (vsE - uOrbC) * 0.1, tour);
    vec4 cs = projectionMatrix * vec4(vsA, 1.0);
    vec4 ce = projectionMatrix * vec4(vsE, 1.0);
    vec2 ps = cs.xy / cs.w * uRes * 0.5;
    vec2 pe = ce.xy / ce.w * uRes * 0.5;
    vec2 dir = pe - ps; float l = length(dir);
    dir = l > 0.0001 ? dir / l : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    vec4 c = mix(cs, ce, aCorner.x);
    vec2 ndc = c.xy / c.w;
    vec2 quadPx = nrm * aCorner.y * aWidth * 0.5 + dir * (aCorner.x * 2.0 - 1.0) * aWidth * 0.5;
    ndc += quadPx * 2.0 / uRes;
    ndc += (vec2(fract(sin(aSeed * 91.7 + floor(uTime * 24.0)) * 43758.5), fract(sin(aSeed * 12.3 + floor(uTime * 24.0)) * 24634.6)) - 0.5) * uJitter * 0.012;
    gl_Position = vec4(ndc * c.w, c.z, c.w);
    float fl = 0.5 + 0.5 * sin(uTime * (0.5 + fract(aSeed * 7.3) * 2.4) + aSeed * 40.0);
    vAlpha = smoothstep(0.08, 0.6, fl) * (0.4 + 0.6 * fract(aSeed * 3.7));
    // Depth: pieces on the far side are dimmer; pieces seen edge-on (the sphere's limb) glow brighter.
    float facing = normalize(mat3(modelViewMatrix) * aStart + vec3(0.0001)).z;
    float limb = pow(1.0 - abs(facing), 2.0);
    vAlpha *= clamp(1.25 - (c.w - 7.0) * 0.3, 0.35, 1.0) * (0.3 + 0.7 * smoothstep(-0.8, 0.6, facing)) * (1.0 + 0.8 * limb) * 0.5 * smoothstep(0.0, 0.3, arrive) * (1.0 - smoothstep(0.05, 0.55, away)) * (1.0 - smoothstep(0.8, 1.0, tour));
    vColor = aColor;
  }`
const DASH_FRAG = /* glsl */ `
  ${THEME_GLSL}
  uniform float uRed; uniform float uBoost;
  varying vec3 vColor; varying float vAlpha;
  void main() {
    gl_FragColor = vec4(themeColor(vColor, uRed) * uBoost, vAlpha);
  }`
const PART_VERT = /* glsl */ `
  ${STREAM_GLSL}
  attribute vec3 aTan; attribute vec3 aColor; attribute float aSeed; attribute float aSize; attribute vec3 aScatter;
  uniform vec2 uRes; uniform float uTime; uniform float uJitter; uniform float uPx; uniform float uAssemble;
  uniform float uScroll; uniform float uTour; uniform vec3 uTourPos; uniform vec3 uOrbC;
  varying vec3 vColor; varying float vAlpha; varying vec2 vDir;
  void main() {
    float arrive = clamp(uAssemble * 1.7 - fract(aSeed * 5.31) * 0.7, 0.0, 1.0);
    arrive = arrive * arrive * (3.0 - 2.0 * arrive);
    vec3 off = aScatter * (1.0 - arrive);
    // Scrolling away: each piece peels off in its own time and drifts down into the star field.
    float away = clamp(uScroll * 1.7 - fract(aSeed * 7.71) * 0.7, 0.0, 1.0);
    away = away * away * (3.0 - 2.0 * away);
    // One shared stream (down and a little to the right), like the name dust, with only a small spread.
    vec3 drift = vec3(STREAM.x + aScatter.y * 0.35, STREAM.y - abs(aScatter.x) * 0.35, aScatter.z * 0.4) * away;
    float tour = clamp(uTour * 1.6 - fract(aSeed * 4.13) * 0.6, 0.0, 1.0);
    tour = tour * tour * (3.0 - 2.0 * tour);
    vec3 vsP = (modelViewMatrix * vec4(position, 1.0)).xyz + off + drift;
    vec3 vsQ = (modelViewMatrix * vec4(position + aTan * 0.02, 1.0)).xyz + off + drift;
    vsP = mix(vsP, uTourPos + (vsP - uOrbC) * 0.1, tour);
    vsQ = mix(vsQ, uTourPos + (vsQ - uOrbC) * 0.1, tour);
    vec4 c = projectionMatrix * vec4(vsP, 1.0);
    vec4 c2 = projectionMatrix * vec4(vsQ, 1.0);
    vec2 d = (c2.xy / c2.w - c.xy / c.w) * uRes;
    float l = length(d);
    vDir = l > 0.0001 ? d / l : vec2(1.0, 0.0);
    gl_Position = c;
    gl_Position.xy += (vec2(fract(sin(aSeed * 91.7 + floor(uTime * 24.0)) * 43758.5), fract(sin(aSeed * 12.3 + floor(uTime * 24.0)) * 24634.6)) - 0.5) * uJitter * 0.012 * c.w;
    gl_PointSize = aSize * uPx * (7.2 / c.w) * (1.0 - 0.45 * away);
    float fl = 0.5 + 0.5 * sin(uTime * (0.4 + fract(aSeed * 7.3) * 2.0) + aSeed * 40.0);
    vAlpha = smoothstep(0.05, 0.6, fl) * (0.35 + 0.65 * fract(aSeed * 3.7));
    vAlpha *= clamp(1.25 - (c.w - 7.0) * 0.3, 0.35, 1.0) * smoothstep(0.0, 0.3, arrive) * (1.0 - smoothstep(0.45, 1.0, away)) * (1.0 - smoothstep(0.8, 1.0, tour));
    vColor = aColor;
  }`
const PART_FRAG = /* glsl */ `
  ${THEME_GLSL}
  uniform float uRed; uniform float uBoost; uniform float uSmear;
  varying vec3 vColor; varying float vAlpha; varying vec2 vDir;
  void main() {
    vec2 p = gl_PointCoord - 0.5; p.y = -p.y;
    float u = dot(p, vDir); float v = dot(p, vec2(-vDir.y, vDir.x));
    float sx = 0.13 + 0.09 * uSmear;
    float i = exp(-(u * u) / (sx * sx) - (v * v) / (0.04 * 0.04));
    float a = vAlpha * i;
    if (a < 0.01) discard;
    gl_FragColor = vec4(themeColor(vColor, uRed) * uBoost, a);
  }`

// The canvas covers the whole hero. The orb is drawn around this point of it (fractions of the
// hero's width and height), where Kairo used to stand, and the camera sits back so it keeps its size.
const ANCHOR = { x: 0.75, y: 0.34 }
const ORB_SCALE = 0.82 // the whole sphere is drawn this much smaller, so it clears the nav and the chat panel
const CAM_Z = 8.2

export function createCore(container, getStateName) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  const pixelRatio = 1

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(pixelRatio)
  renderer.setClearColor(0x000000, 0)
  renderer.domElement.className = 'core-canvas'
  container.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
  camera.position.set(0, 0, CAM_Z)
  const uRes = { value: new THREE.Vector2(1, 1) }

  // Shared uniforms; the dashes and the streak particles read the same values.
  const U = { uTime: { value: 0 }, uSmear: { value: 0.1 }, uJitter: { value: 0 }, uRed: { value: 0 }, uBoost: { value: 1 }, uAssemble: { value: 0 }, uScroll: { value: 0 }, uTour: { value: 0 }, uTourPos: { value: new THREE.Vector3(0, 0, -CAM_Z) }, uOrbC: { value: new THREE.Vector3(0, 0, -CAM_Z) }, uColA: { value: new THREE.Vector3(1, 0.6, 0.06) }, uColB: { value: new THREE.Vector3(1, 0.3, 0) }, uColC: { value: new THREE.Vector3(1, 0.75, 0.3) }, uRes }
  // Where the pieces start from: far to the left (the name's place), spread out in height and depth.
  const scatter = () => [rnd(-6.5, -3), rnd(-1.6, 1.6), rnd(-1.2, 1.2)]
  const fragMat = new THREE.ShaderMaterial({
    uniforms: U, vertexShader: DASH_VERT, fragmentShader: DASH_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const partMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uPx: { value: pixelRatio } }, vertexShader: PART_VERT, fragmentShader: PART_FRAG,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
  })

  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.3, 0.55)
  composer.addPass(bloom)
  // Last pass: turn brightness into transparency, so the canvas is genuinely see-through and
  // needs no blend mode. Whatever is behind it (any theme) shows wherever the orb is dark.
  composer.addPass(new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); vec3 t = 1.0 - exp(-1.0 * max(c.rgb, vec3(0.0))); float a = clamp(max(t.r, max(t.g, t.b)), 0.0, 1.0); gl_FragColor = vec4(t, a); }', // soft tone-map: overlaps roll off toward white instead of clipping to flat colour
  }))

  function resize() {
    const w = Math.max(container.clientWidth, 1)
    const h = Math.max(container.clientHeight, 1)
    renderer.setSize(w, h)
    composer.setSize(w, h)
    bloom.setSize(w / 2, h / 2) // the glow is soft anyway: half resolution costs a quarter as much
    camera.aspect = w / h
    camera.position.z = CAM_Z
    // Shift the view so the orb lands on the anchor point instead of the middle.
    camera.setViewOffset(w, h, w / 2 - ANCHOR.x * w, h / 2 - ANCHOR.y * h, w, h)
    camera.updateProjectionMatrix()
    uRes.value.set(w * pixelRatio, h * pixelRatio)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(container)
  resize()

  // One dash = one camera-facing quad with real thickness.
  function dashes() {
    const S = []
    return {
      add(a, b, w = 1.4, smear = 0, bright = 1, color) {
        const c = color || pick(PAL)
        S.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0] * bright, c[1] * bright, c[2] * bright, w, smear, Math.random() * 100, ...scatter())
      },
      mesh() {
        const n = S.length / 15
        const start = new Float32Array(n * 12), end = new Float32Array(n * 12), corner = new Float32Array(n * 8)
        const col = new Float32Array(n * 12), seed = new Float32Array(n * 4), smear = new Float32Array(n * 4), width = new Float32Array(n * 4)
        const scat = new Float32Array(n * 12)
        const idx = new Uint32Array(n * 6)
        const cs = [0, -1, 0, 1, 1, -1, 1, 1]
        for (let i = 0; i < n; i++) {
          const o = i * 15
          for (let v = 0; v < 4; v++) {
            const k = i * 4 + v
            for (let j = 0; j < 3; j++) {
              start[k * 3 + j] = S[o + j]; end[k * 3 + j] = S[o + 3 + j]; col[k * 3 + j] = S[o + 6 + j]; scat[k * 3 + j] = S[o + 12 + j]
            }
            corner[k * 2] = cs[v * 2]; corner[k * 2 + 1] = cs[v * 2 + 1]
            width[k] = S[o + 9]; smear[k] = S[o + 10]; seed[k] = S[o + 11]
          }
          const b = i * 4
          idx.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.BufferAttribute(start, 3))
        g.setAttribute('aStart', new THREE.BufferAttribute(start, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 3))
        g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2)); g.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
        g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1)); g.setAttribute('aSmear', new THREE.BufferAttribute(smear, 1))
        g.setAttribute('aWidth', new THREE.BufferAttribute(width, 1)); g.setIndex(new THREE.BufferAttribute(idx, 1))
        g.setAttribute('aScatter', new THREE.BufferAttribute(scat, 3))
        const m = new THREE.Mesh(g, fragMat)
        m.frustumCulled = false
        return m
      },
    }
  }
  // One particle = one GPU point drawn as a soft short streak along its direction.
  function particles() {
    const P = [], T = [], C = [], Sd = [], Z = [], Sc = []
    return {
      add(p, t, bright = 1, size = 14, color) {
        const c = color || pick(PAL)
        P.push(p[0], p[1], p[2]); T.push(t[0], t[1], t[2])
        C.push(c[0] * bright, c[1] * bright, c[2] * bright); Sd.push(Math.random() * 100); Z.push(size * rnd(0.7, 1.3)); Sc.push(...scatter())
      },
      mesh() {
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aTan', new THREE.Float32BufferAttribute(T, 3))
        g.setAttribute('aColor', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('aSeed', new THREE.Float32BufferAttribute(Sd, 1))
        g.setAttribute('aSize', new THREE.Float32BufferAttribute(Z, 1)); g.setAttribute('aScatter', new THREE.Float32BufferAttribute(Sc, 3))
        const m = new THREE.Points(g, partMat)
        m.frustumCulled = false
        return m
      },
    }
  }

  const orb = new THREE.Group()
  scene.add(orb)
  const spinners = []

  // ---- the data sphere: tangent circuit traces on nested shells, thinned by noise ----
  // Cheap smooth 3D value noise (no library): its peaks become dense clusters, its troughs dark voids.
  const noiseOff = [rnd(0, 100), rnd(0, 100), rnd(0, 100)]
  const hash3 = (x, y, z) => {
    const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
    return s - Math.floor(s)
  }
  const noise3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
    const u = (t) => t * t * (3 - 2 * t)
    const fx = u(x - xi), fy = u(y - yi), fz = u(z - zi)
    const l = (a, b, t) => a + (b - a) * t
    const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz)
    return l(
      l(l(c(0, 0, 0), c(1, 0, 0), fx), l(c(0, 1, 0), c(1, 1, 0), fx), fy),
      l(l(c(0, 0, 1), c(1, 0, 1), fx), l(c(0, 1, 1), c(1, 1, 1), fx), fy),
      fz,
    )
  }
  // 0..1: the chance a piece at this spot survives. About 45% of candidates are culled, in patches, so
  // the voids are real gaps; a small floor keeps them from being perfectly empty.
  const density = (p) => {
    const n = 0.6 * noise3(p.x * 2.4 + noiseOff[0], p.y * 2.4 + noiseOff[1], p.z * 2.4 + noiseOff[2]) +
      0.4 * noise3(p.x * 5.1 + noiseOff[1], p.y * 5.1 + noiseOff[2], p.z * 5.1 + noiseOff[0])
    const t = Math.min(1, Math.max(0, (n - ORB_CONFIG.voidEdge[0]) / (ORB_CONFIG.voidEdge[1] - ORB_CONFIG.voidEdge[0])))
    return 0.03 + 0.97 * t * t * (3 - 2 * t)
  }
  const unit = () => {
    const a = rnd(0, TAU), c = rnd(-1, 1), s = Math.sqrt(1 - c * c)
    return new THREE.Vector3(s * Math.cos(a), c, s * Math.sin(a))
  }
  const arr = (v) => [v.x, v.y, v.z]
  const budget = ORB_CONFIG.segmentCount * (lowEnd ? 0.6 : 1)
  const SPHERE_R = 1.1

  // A random heading in the tangent plane at n: no dominant direction anywhere.
  const heading = (n) => new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).cross(n).normalize()
  // Per-piece colour: mostly the theme's orb colour, some deeper, some lighter (the heat picks the tone).
  const heat = () => {
    const t = Math.random()
    return [1.0, t < 0.25 ? rnd(0.26, 0.36) : t < 0.75 ? rnd(0.5, 0.58) : rnd(0.68, 0.8), 0.02]
  }

  // One shell of short fragments (radius r), each at its own random orientation; about a fifth turn
  // through a right angle, like a circuit trace. `volume` scatters them through the ball instead.
  function traces({ r, count, volume = false, spin }) {
    const b = dashes(), pb = particles()
    for (let k = 0; k < count; k++) {
      const n0 = unit()
      const rr = volume ? r * Math.cbrt(Math.random()) : r * (1 + rnd(-0.02, 0.02))
      const p = n0.clone().multiplyScalar(rr)
      if (Math.random() > density(p)) continue
      const white = Math.random() < 0.01 // ~1% white-hot sparks
      const len = SPHERE_R * rnd(ORB_CONFIG.segmentLength[0], ORB_CONFIG.segmentLength[1])
      const dir = heading(n0)
      const q = p.clone().addScaledVector(dir, len).setLength(rr)
      const smear = Math.random() < 0.05 ? rnd(2, 5) : 0.3 // a few motion-blurred streaks
      const width = white ? rnd(2.2, 3.2) : rnd(1.0, 1.8)
      b.add(arr(p), arr(q), width, smear, white ? 1.5 : rnd(0.7, 1.1), white ? WHITE_HOT : heat())
      if (Math.random() < 0.2) {
        // Right-angle bend: turn 90 degrees in the tangent plane at the new end.
        const nrm = q.clone().normalize()
        const along = q.clone().sub(p).normalize()
        along.addScaledVector(nrm, -along.dot(nrm)).normalize()
        const turn = nrm.clone().cross(along).multiplyScalar(Math.random() < 0.5 ? 1 : -1)
        const q2 = q.clone().addScaledVector(turn, len * rnd(0.8, 1.6)).setLength(rr)
        b.add(arr(q), arr(q2), width, 0.3, rnd(0.7, 1.1), heat())
        if (Math.random() < 0.4) pb.add(arr(q), arr(turn), 0.8, 14) // a bright node at the corner
      }
    }
    // The odd oversized white-hot spark riding on the shell.
    for (let k = 0; k < ORB_CONFIG.sparkCount / ORB_CONFIG.shellCount; k++) {
      const q = unit().multiplyScalar(volume ? r * rnd(0.3, 1) : r)
      if (Math.random() < density(q) + 0.2) pb.add(arr(q), arr(unit()), 1.8, rnd(30, 44), WHITE_HOT)
    }
    const wrap = new THREE.Group()
    wrap.rotation.set(rnd(-1.2, 1.2), rnd(-1.2, 1.2), rnd(-1.2, 1.2))
    const m1 = b.mesh(), m2 = pb.mesh()
    wrap.add(m1, m2)
    orb.add(wrap)
    spinners.push({ m: m1, spin }, { m: m2, spin })
  }

  {
    // Shells from a thin inner one out to the rim; each gets traces in proportion to its surface area.
    const radii = Array.from({ length: ORB_CONFIG.shellCount }, (_, i) => 0.32 + (i / (ORB_CONFIG.shellCount - 1)) * 0.78)
    const area = radii.reduce((a, r) => a + r * r, 0)
    const shellBudget = budget * (1 - ORB_CONFIG.innerShare)
    radii.forEach((r, i) => {
      const spin = (i % 2 ? 1 : -1) * (0.035 + 0.03 * i) // each shell turns at its own speed, for parallax
      traces({ r, count: Math.round((shellBudget * r * r) / area), spin })
    })
    traces({ r: 0.7, count: Math.round(budget * ORB_CONFIG.innerShare), volume: true, spin: 0.11 })
  }
  // A faint hollow veil of dust: thinned by the same noise, it adds depth without filling the voids.
  {
    const ps = particles()
    const dust = Math.round(ORB_CONFIG.dustCount * (lowEnd ? 0.6 : 1))
    for (let k = 0, made = 0; made < dust && k < dust * 20; k++) {
      const n = unit(), r = rnd(0.6, 1.12)
      if (Math.random() > density(n.clone().multiplyScalar(r))) continue
      const t = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).cross(n).normalize()
      ps.add(arr(n.clone().multiplyScalar(r)), arr(t), rnd(0.25, 0.7), 12)
      made++
    }
    const m = ps.mesh(); orb.add(m); spinners.push({ m, spin: 0.05, axis: 'y' })
  }

  // The hub: a bright core with a few Lissajous ribbons swirling around it (no bullseye rings).
  const core = new THREE.Group()
  core.position.set(0, 0, 0.05)
  orb.add(core)
  for (let i = 0; i < ORB_CONFIG.ribbonCount; i++) {
    const [fa, fb, fc] = [[3, 2, 5], [2, 3, 4], [3, 4, 2], [5, 3, 2]][i % 4]
    const rad = 0.06 + i * 0.03, ph = [rnd(0, TAU), rnd(0, TAU), rnd(0, TAU)]
    const pt = (f) => {
      const t = f * TAU
      return [Math.sin(fa * t + ph[0]) * rad, Math.sin(fb * t + ph[1]) * rad * 0.9, Math.sin(fc * t + ph[2]) * rad]
    }
    const b = dashes()
    for (const [width, bright, col] of [[1.8, 1.1, PALE], [0.9, 0.8, undefined]]) {
      for (let k = 0; k < 150; k++) b.add(pt(k / 150), pt((k + 1) / 150), width, 0.3, bright, col)
    }
    const wrap = new THREE.Group()
    wrap.rotation.set(rnd(0, TAU), rnd(0, TAU), 0)
    const m = b.mesh(); wrap.add(m); core.add(wrap)
    spinners.push({ m, spin: (i % 2 ? 1 : -1) * rnd(0.35, 0.7) })
  }

  // Soft glow sprites: the hub glow, a haze behind, and a few out-of-focus blobs.
  const c2d = document.createElement('canvas')
  c2d.width = c2d.height = 128
  const x2d = c2d.getContext('2d'), grad = x2d.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.3, 'rgba(255,255,255,0.35)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
  x2d.fillStyle = grad; x2d.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c2d)
  const sprite = (color, opacity, scale, pos) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, opacity, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }))
    s.scale.setScalar(scale); s.position.set(...pos)
    return s
  }
  const coreGlow = sprite(0xff7a10, 0.5, 0.3, [0, 0, 0]); core.add(coreGlow)
  const haze = sprite(0xff8a1c, 0.05, 3.4, [0, 0, -0.5]); scene.add(haze)
  const bokeh = []
  let sparkMat = null
  for (let i = 0; i < 16; i++) {
    const s = sprite(0xffa020, rnd(0.05, 0.12), rnd(0.2, 0.6), [rnd(-2.4, 2.4), rnd(-1.3, 1.3), rnd(-1.5, 0.5)])
    s.userData = { ph: rnd(0, 6) }; scene.add(s); bokeh.push(s)
  }
  {
    const n = 450, pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const a = rnd(0, TAU), c = Math.acos(rnd(-1, 1)), r = rnd(0.25, 1.15)
      pos.set([Math.sin(c) * Math.cos(a) * r, Math.cos(c) * r, Math.sin(c) * Math.sin(a) * r], i * 3)
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    sparkMat = new THREE.PointsMaterial({ map: tex, color: 0xffb340, size: 0.035, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    const p = new THREE.Points(g, sparkMat)
    orb.add(p); spinners.push({ m: p, spin: 0.09, axis: 'y' })
  }

  // ---- input and loop ----
  const mouse = { x: 0, y: 0 }
  let scroll = 0 // 0 at the top of the page, 1 once the hero has scrolled away
  let tour = 0 // 0 = the orb, 1 = all of it has flown into the guide Kairo
  let tourOn = false
  let lastForm = null // last --kairo-form value written to the page
  let kairoPx = null // where the docked guide Kairo is on screen (CSS pixels)
  let lastInput = performance.now()
  const onInput = () => {
    lastInput = performance.now()
  }
  const onMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2
    onInput()
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  for (const ev of ['keydown', 'pointerdown', 'wheel']) window.addEventListener(ev, onInput, { passive: true })

  const ASSEMBLE_MS = 2800
  const SLEEP_MS = 30000 // like Kairo: it dozes off after 30s without input
  let assembleStart = -1 // -1 = not started (nothing is drawn yet); set by assemble()
  let ringStart = -1
  let sleep = 0
  let tones = themeTones()
  let lastTone = performance.now()
  U.uColA.value.set(...tones.main); U.uColB.value.set(...tones.deep); U.uColC.value.set(...tones.pale)
  let cur = { ...CORE_STATES.idle }
  let active = true
  let raf = 0
  let last = performance.now()
  let time = 0
  function frame(now) {
    raf = 0
    if (!active) return
    raf = requestAnimationFrame(frame)
    // Until the intro starts there is nothing to draw, so skip the GPU work entirely.
    if (assembleStart < 0) {
      last = now
      return
    }
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    const asmK = reducedMotion ? 1 : Math.min(1, (now - assembleStart) / ASSEMBLE_MS)
    U.uAssemble.value = asmK
    const glowK = asmK * asmK * (3 - 2 * asmK)
    sleep += ((now - lastInput > SLEEP_MS ? 1 : 0) - sleep) * Math.min(1, dt * 1.5)
    const ring = ringStart >= 0 && now - ringStart < 900 ? 1 - ((now - ringStart) / 900) ** 2 : 0
    // Follow the theme: re-read its accent a few times a second and ease toward it.
    if (now - lastTone > 250) {
      lastTone = now
      tones = themeTones()
    }
    const ease = Math.min(1, dt * 4)
    for (const [u, t] of [[U.uColA.value, tones.main], [U.uColB.value, tones.deep], [U.uColC.value, tones.pale]]) {
      u.set(u.x + (t[0] - u.x) * ease, u.y + (t[1] - u.y) * ease, u.z + (t[2] - u.z) * ease)
    }
    // Scroll: the orb comes apart as the hero scrolls away and reassembles on the way back up.
    const away = Math.min(1, Math.max(0, window.scrollY / Math.max(container.clientHeight * 0.7, 1)))
    scroll += (away - scroll) * Math.min(1, dt * 6)
    U.uScroll.value = scroll

    // Tour: while it runs, follow the docked Kairo clock; the pieces fly to wherever it is.
    if (tourOn) {
      const m = document.querySelector('.mascot.is-touring')
      if (m) {
        const r = m.getBoundingClientRect()
        kairoPx = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
      }
    }
    tour += ((tourOn ? 1 : 0) - tour) * Math.min(1, dt * (tourOn ? 2.4 : 1.8))
    if (kairoPx) {
      const box = container.getBoundingClientRect()
      const unitsPerPx = (2 * CAM_Z * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(box.height, 1)
      const dx = kairoPx.x - (box.left + ANCHOR.x * box.width)
      const dy = kairoPx.y - (box.top + ANCHOR.y * box.height)
      U.uTourPos.value.set(dx * unitsPerPx, -dy * unitsPerPx, -CAM_Z)
    }
    U.uTour.value = tour
    // Tell the CSS how far the pieces have arrived (0.45 → 0.95 of the tour, when the last of them
    // are landing and fading), so the guide Kairo forms out of them instead of on a fixed timer.
    const formT = Math.min(1, Math.max(0, (tour - 0.45) / 0.5))
    const form = (formT * formT * (3 - 2 * formT)).toFixed(3)
    if (form !== lastForm) {
      lastForm = form
      document.documentElement.style.setProperty('--kairo-form', form)
    }
    const target = CORE_STATES[getStateName()] || CORE_STATES.idle
    for (const k of ['speed', 'scale', 'pulse', 'red', 'jitter', 'smear']) cur[k] += (target[k] - cur[k]) * Math.min(1, dt * 3)
    const sp = (reducedMotion ? 0 : cur.speed * ORB_CONFIG.rotationSpeed) * (1 - 0.65 * sleep)
    time += dt * sp
    for (const s of spinners) {
      if (s.axis === 'y') s.m.rotation.y += dt * sp * s.spin
      else s.m.rotation.z += dt * sp * s.spin
    }
    const talk = reducedMotion ? 0 : cur.pulse * (0.5 + 0.5 * Math.sin(now / 95)) * (0.5 + 0.5 * Math.sin(now / 410))
    U.uTime.value = time
    U.uSmear.value = reducedMotion ? 0 : cur.smear + ring * 1.5
    U.uJitter.value = cur.jitter + ring * 0.8
    U.uRed.value = cur.red
    U.uBoost.value = 0.4 * (1 + talk * 0.35 + ring * 1.2) * (1 - 0.5 * sleep)
    const breathe = 1 + Math.sin(time * 1.2) * 0.012 + talk * 0.03
    const size = cur.scale * breathe * (1 - 0.06 * sleep)
    orb.scale.setScalar(size * ORB_SCALE)
    orb.position.x = Math.sin(now / 18) * 0.02 * ring
    const tiltK = reducedMotion ? 0 : 1 // mouse parallax off under reduced motion
    orb.rotation.set(-0.05 + mouse.y * 0.06 * tiltK, Math.sin(time * 0.16) * 0.07 + mouse.x * 0.1 * tiltK, -0.04)
    const A = U.uColA.value
    coreGlow.material.color.setRGB(A.x + (1 - A.x) * cur.red, A.y * (1 - cur.red * 0.7), A.z * (1 - cur.red))
    coreGlow.material.opacity = 0.45 * glowK * (1 - tour) * (1 - 0.5 * sleep) * (1 + ring * 0.5)
    coreGlow.scale.setScalar(0.3 + talk * 0.1 + ring * 0.15) // the core is ~15% of the sphere's radius
    haze.material.color.setRGB(U.uColB.value.x, U.uColB.value.y * (1 - cur.red * 0.6), U.uColB.value.z)
    haze.material.opacity = 0.05 * glowK * (1 - tour)
    for (const s of bokeh) s.material.opacity = (0.06 + 0.05 * Math.sin(time * 0.7 + s.userData.ph)) * glowK * (1 - tour)
    sparkMat.opacity = 0.9 * glowK * (1 - tour)
    sparkMat.color.setRGB(A.x, A.y, A.z)
    bloom.strength = ORB_CONFIG.bloomStrength + talk * 0.3 + cur.red * 0.15 + ring * 0.5
    if (scroll < 0.995 && tour < 0.995) composer.render() // scrolled away or flown into Kairo: nothing left to draw
  }
  raf = requestAnimationFrame(frame)

  return {
    // Start the intro: the orb's pieces fly in from the left, where the name was, and assemble.
    assemble() {
      if (assembleStart < 0) assembleStart = performance.now()
    },
    // The tour starts: the pieces fly into the guide Kairo. It ends: they fly back out and re-form the orb.
    tourStart() {
      tourOn = true
      // Kairo must not show before the pieces get there (this runs before it mounts). If the orb is
      // paused (off screen or a hidden tab) nothing will fly, and the loop that would publish the
      // value is not running, so Kairo simply appears.
      if (!active) tour = 1
      lastForm = active ? '0.000' : '1.000'
      document.documentElement.style.setProperty('--kairo-form', active ? '0' : '1')
    },
    tourEnd() {
      tourOn = false
      if (!active) tour = 0 // paused: nothing to animate back, the orb is simply whole again
    },
    // The alarm: a quick bright, shaking flash (Kairo rings its alarm when clicked).
    ring() {
      ringStart = performance.now()
    },
    // Pause the loop while the orb is off screen or the tab is hidden.
    setActive(on) {
      if (on === active) return
      active = on
      // Pausing in the middle of a tour would freeze Kairo's fade half way (the loop publishes it),
      // so finish it now: the pieces are out of sight anyway.
      if (!on && tourOn) {
        tour = 1
        lastForm = '1.000'
        document.documentElement.style.setProperty('--kairo-form', '1')
      }
      if (on && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    },
    dispose() {
      active = false
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      for (const ev of ['keydown', 'pointerdown', 'wheel']) window.removeEventListener(ev, onInput)
      ro.disconnect()
      document.documentElement.style.removeProperty('--kairo-form')
      scene.traverse((o) => {
        o.geometry?.dispose?.()
        const m = o.material
        if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose?.())
      })
      tex.dispose()
      fragMat.dispose()
      partMat.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
