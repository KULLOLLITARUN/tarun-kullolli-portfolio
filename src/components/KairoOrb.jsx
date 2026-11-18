import { useEffect, useRef } from 'react'
import { orbController } from '../orb/orbController.js'
import {
  ASSEMBLE,
  CONTRACT,
  EASE,
  FLASH,
  HEART,
  MASS,
  SHELL_FADE,
  SMALL_MAX,
  THINK,
  TYPING,
  WAKE,
} from '../orb/orbTheme.js'

// Kairo's holographic orb: a gold shell and, inside it, an electric glass mass.
// Outer layers (shell streaks, circuit arcs, tick rings, outer glow): the site's accent colour
// (--accent-rgb) in every state. Inner layers (translucent glass sheets, scratches, rim loops,
// the white-hot heart with its rays, bolts, clouds, glitter and dust): one eased inner colour that
// changes with the state (orb/orbTheme.js INNER). Ported from docs/kairo-orb/kairo-orb-reference.html.
// Plain Canvas 2D on a transparent canvas, additive light. Decorative only (aria-hidden); the chat
// announces its own status.
// State, clock and event animations (wake-up, typing, send, thinking, flash, speaking) come from the
// shared orb/orbController.js, with every number in orb/orbTheme.js, so the hero orb and the header
// avatar move together. Canvases of SMALL_MAX px or less get the simplified version (a few sheets and
// scratches and the heart; no edge dashes, ribbing, glitter, dust, rim loops, clouds or bolts).

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / l, v[1] / l, v[2] / l]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const randUnit = () => {
  const u = rnd(-1, 1)
  const t = rnd(0, TAU)
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(t), u, s * Math.sin(t)]
}
const tangentAt = (p) => {
  const r = randUnit()
  const d = dot(r, p)
  return norm([r[0] - d * p[0], r[1] - d * p[1], r[2] - d * p[2]])
}

// The orb's base colour: the root's --accent-rgb as hue and saturation (floored, so a pale accent
// does not wash out to grey). Falls back to amber if the token is missing or unreadable.
const FALLBACK_RGB = [245, 181, 68]
function readAccent() {
  let rgb = FALLBACK_RGB
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb')
    const p = raw.split(',').map((x) => parseFloat(x))
    if (p.length >= 3 && p.slice(0, 3).every((x) => x >= 0 && x <= 255)) rgb = p
  } catch {
    /* keep the fallback */
  }
  const [r, g, b] = rgb.map((x) => x / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
  }
  const l = (max + min) / 2
  const sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0
  return { h: (h * 60 + 360) % 360, s: Math.round(Math.max(0.35, sat) * 100) }
}

const SPARK_GOLD = 'rgba(255,200,90,'
// An inner element's colour: the inner colour mixed toward white by w (0 = inner, 1 = white), or
// scaled darker by f (a deep tone of the same colour).
const mix = (c, w, a) =>
  `rgba(${Math.round(c[0] * (1 - w) + 255 * w)},${Math.round(c[1] * (1 - w) + 255 * w)},${Math.round(c[2] * (1 - w) + 255 * w)},${a})`
const deep = (c, f, a) => `rgba(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)},${a})`
const DASHES = [9, 24]
const NO_DASH = []

const SCROLL_RES = 0.5 // canvas resolution while the page is scrolling (1 = full)
const SCROLL_RES_HOLD = 150 // ms after the last scroll before it goes back to full

// How the shell's streaks drift when the page scrolls (all in radii of the orb): down, a little right,
// a small spread, barely stretched (they read as sparks, not sticks); overChat is how much of their
// brightness is left while they pass in front of the chat panel, so its text stays readable.
const DRIFT = {
  down: 3.2,
  right: 0.15,
  spread: 0.3,
  stretch: 0.5,
  trail: 0.04,
  glow: 1.4,
  thick: 0.5,
  lift: 22,
  overChat: 0.18,
}

// onFail is called if the canvas cannot draw, so the caller can bring Kairo's own art back.
// scrollApart (the hero orb): as the page scrolls the orb's pieces peel off, one after another, and
// drift down and a little right (like main's AI-core orb), then come back when scrolling up. tail is
// the extra canvas below the orb, in px, that the pieces drift through.
export default function KairoOrb({
  size = 310,
  density = 1,
  ticks = true,
  scrollApart = false,
  tail = 0,
  onFail,
  onLight,
  className,
  style,
}) {
  const canvasRef = useRef(null)
  // The hero orb calls onLight(strength, innerRgb) every frame, so the page can be lit by it.
  const lightRef = useRef(onLight)
  useEffect(() => {
    lightRef.current = onLight
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onFail?.()
      return
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(size * DPR)
    canvas.height = Math.round((size + tail) * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
    // While the page is scrolling the orb is moving apart and fading, so it is drawn at a lower
    // resolution (the canvas keeps its CSS size) and goes back to full once scrolling has stopped.
    let q = 1
    const setRes = (nq) => {
      if (nq === q) return
      q = nq
      canvas.width = Math.round(size * DPR * q)
      canvas.height = Math.round((size + tail) * DPR * q)
      ctx.setTransform(DPR * q, 0, 0, DPR * q, 0, 0)
    }
    let lastY = 0
    let lastMove = -1e9
    let scrolling = false
    let skipFrame = false
    let owedDt = 0

    const c0 = size / 2
    const R = size * 0.4
    const k = Math.max(0.4, Math.min(1.3, R / 170))
    const small = size <= SMALL_MAX // the avatar: the simplified version
    const ki = small ? 0.8 : k // line widths of the glass mass

    // ---- colour: re-read when the theme changes -------------------------
    let pal = readAccent()
    const onTheme = () => {
      pal = readAccent()
    }
    window.addEventListener('theme-change', onTheme)
    const mo = new MutationObserver(onTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] })
    // dh is the hue offset from the accent (the gold spread is about +-7 degrees)
    const tint = (dh, l, a) => `hsla(${pal.h + dh},${pal.s}%,${l}%,${a})`

    // ---- outer geometry: the gold shell ------------------------------------
    const shell = Array.from({ length: Math.round(1700 * density) }, () => {
      const p = randUnit()
      const sa = rnd(0, TAU)
      const sd = rnd(ASSEMBLE.from[0], ASSEMBLE.from[1])
      return {
        sx: Math.cos(sa) * sd, // where it starts when it flies in on wake-up (radius units from the centre)
        sy: Math.sin(sa) * sd,
        d: Math.random(), // its start delay, 0 to 1 of the spread
        p,
        t: tangentAt(p),
        len: rnd(0.012, 0.075),
        h: rnd(-7, 7),
        l: rnd(55, 76),
        a: rnd(0.25, 1),
        rad: rnd(0.95, 1.05),
        k: Math.random(), // when it peels off as the page scrolls (0 to 1 of the spread)
        ph: rnd(0, TAU),
      }
    })

    // arcs stay out near the shell (from 0.8 of the radius) so they do not tangle the glass inside
    const arcs = Array.from({ length: Math.max(10, Math.round(80 * density)) }, () => {
      const n = randUnit()
      const a = tangentAt(n)
      const b = cross(n, a)
      const segs = []
      let s = rnd(0, TAU)
      for (let q = 0, c = Math.floor(rnd(1, 4)); q < c; q++) {
        const sp = rnd(0.25, 1.3)
        segs.push([s, sp])
        s += sp + rnd(0.15, 0.7)
      }
      return {
        a,
        b,
        r: rnd(0.8, 1.03),
        segs,
        spin: rnd(-0.25, 0.25),
        w: rnd(0.6, 1.7),
        h: rnd(-7, 7),
        al: rnd(0.35, 0.95),
      }
    })

    const rings = ticks
      ? Array.from({ length: 4 }, (_, i) => {
          const n = randUnit()
          const a = tangentAt(n)
          return { a, b: cross(n, a), r: rnd(0.9, 1.02), spin: rnd(0.05, 0.2) * (i % 2 ? -1 : 1), ticks: 130 + i * 20 }
        })
      : []

    // ---- inner geometry: the glass mass ------------------------------------
    // overlapping translucent sheets (angular polygons, drawn with softened corners)
    const sheetCount = small ? MASS.sheetsSmall : MASS.sheets
    const sheets = Array.from({ length: sheetCount }, (_, idx) => {
      const big = idx < 6
      const c = randUnit()
      const r = Math.cbrt(Math.random()) * (big ? 0.3 : 0.26)
      const n = randUnit()
      const u = tangentAt(n)
      const nv = Math.floor(rnd(5, 8))
      return {
        c: [c[0] * r, c[1] * r, c[2] * r],
        n,
        u,
        v: cross(n, u),
        s: big ? rnd(0.46, 0.64) : rnd(0.28, 0.46),
        poly: Array.from({ length: nv }, (_, i) => ({ a: (i / nv) * TAU + rnd(-0.3, 0.3), r: rnd(0.5, 1.18) })),
        sp: rnd(0.05, 0.22) * (Math.random() < 0.5 ? -1 : 1),
        ph: rnd(0, TAU),
        fold: rnd(0.03, 0.08),
        al: big ? rnd(0.7, 1) : rnd(0.45, 0.9),
        big,
      }
    })
    // fine light scratches through the volume, denser toward the centre
    const scratches = Array.from({ length: small ? MASS.scratchesSmall : MASS.scratches }, () => {
      const d = randUnit()
      const r = Math.pow(Math.random(), 1.35) * 0.74
      return {
        c: [d[0] * r, d[1] * r, d[2] * r],
        dir: randUnit(),
        h: rnd(0.03, 0.2),
        ph: rnd(0, TAU),
        sp: rnd(1, 6),
        al: rnd(0.15, 0.55),
        w: rnd(0.4, 0.9),
      }
    })
    const sparklets = small
      ? []
      : Array.from({ length: MASS.sparklets }, () => {
          const d = randUnit()
          return { d, t: tangentAt(d), r: rnd(0.8, 1.02), h: rnd(0.015, 0.06), ph: rnd(0, TAU), sp: rnd(1, 5) }
        })
    const rays = small
      ? []
      : Array.from({ length: MASS.rays }, () => ({
          dir: randUnit(),
          len: rnd(0.18, 0.6),
          ph: rnd(0, TAU),
          sp: rnd(2, 6),
        }))
    // thin wobbly rim loops (billboards, so the outline always reads)
    const rims = small
      ? []
      : Array.from({ length: 2 }, () => ({
          r: rnd(0.7, 0.75),
          m: Math.round(rnd(3, 7)),
          m2: Math.round(rnd(8, 14)),
          ph: rnd(0, TAU),
          ph2: rnd(0, TAU),
          w: rnd(1.6, 2.6),
          off: [rnd(-0.04, 0.04), rnd(-0.04, 0.04)],
        }))
    const clouds = small
      ? []
      : Array.from({ length: MASS.clouds }, () => ({
          p: randUnit(),
          s: rnd(0.15, 0.5),
          r: rnd(0.25, 0.5),
          ph: rnd(0, TAU),
          sp: rnd(0.2, 0.6),
        }))
    const dust = small
      ? []
      : Array.from({ length: MASS.dust }, () => {
          const d = randUnit()
          const r = Math.cbrt(Math.random()) * 0.76
          return { p: [d[0] * r, d[1] * r, d[2] * r], ph: rnd(0, TAU), sp: rnd(1, 4), s: rnd(0.5, 1.6) }
        })

    const sparks = []

    // ---- projection --------------------------------------------------
    let cy_ = 1
    let sy_ = 0
    let cp_ = 1
    let sp_ = 0 // the shell's rotation
    let cyC = 1
    let syC = 0
    let cpC = 1
    let spC = 0 // the glass mass turns the other way, a little slower
    let sc = 1
    const rot = (v) => {
      const x = v[0] * cy_ + v[2] * sy_
      const z = -v[0] * sy_ + v[2] * cy_
      return [x, v[1] * cp_ - z * sp_, v[1] * sp_ + z * cp_]
    }
    const rotC = (v) => {
      const x = v[0] * cyC + v[2] * syC
      const z = -v[0] * syC + v[2] * cyC
      return [x, v[1] * cpC - z * spC, v[1] * spC + z * cpC]
    }
    const pr = (v, m = 1) => {
      const f = (1 / (1 - v[2] * 0.12)) * sc * m
      return [c0 + v[0] * R * f, c0 + v[1] * R * f]
    }
    const dA = (z) => 0.3 + (0.7 * (z + 1)) / 2
    const lp = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]

    // ---- loop state --------------------------------------------------
    const C = orbController // the shared clock, state and events (orb/orbController.js)
    let mx = 0
    let my = 0
    const tilt = [0, 0]
    let raf = 0
    let visible = true
    let inFront = false
    let blank = false // the canvas has been cleared because the orb has scrolled fully away
    // The hero's height and where the chat panel sits in this canvas. Reading them forces layout, and
    // scrolling doesn't move them relative to the canvas, so they are read at most every 400 ms.
    const layout = { heroH: 0, chatBox: null, at: -1e9 }
    const refreshLayout = () => {
      const now = performance.now()
      if (now - layout.at < 400) return
      layout.at = now
      const hero = canvas.closest('.hero')
      layout.heroH = hero?.clientHeight ?? 0
      const ch = hero?.querySelector('.chat')
      if (ch) {
        const cr = ch.getBoundingClientRect()
        const kr = canvas.getBoundingClientRect()
        layout.chatBox = [cr.left - kr.left, cr.top - kr.top, cr.right - kr.left, cr.bottom - kr.top]
      } else layout.chatBox = null
    }
    let sa = 0 // 0 at the top of the page, 1 once the hero has scrolled away (eased)
    const sm = (a, b, x) => {
      const q = clamp01((x - a) / (b - a))
      return q * q * (3 - 2 * q)
    }

    const onMove = (e) => {
      mx = e.clientX / window.innerWidth - 0.5
      my = e.clientY / window.innerHeight - 0.5
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const draw = (dt) => {
      const { cur, inner, t, mode, env, act } = C
      const ic = (a) => mix(inner, 0, a)
      const iw = (w, a) => mix(inner, w, a)
      tilt[0] += (my * 0.7 - tilt[0]) * 0.05
      tilt[1] += (mx * 0.9 - tilt[1]) * 0.05
      cy_ = Math.cos(C.yaw + tilt[1])
      sy_ = Math.sin(C.yaw + tilt[1])
      const pit = -0.28 + tilt[0]
      cp_ = Math.cos(pit)
      sp_ = Math.sin(pit)
      const yc = -C.yaw * 0.6 + tilt[1] + 0.5
      cyC = Math.cos(yc)
      syC = Math.sin(yc)
      cpC = Math.cos(pit + 0.12)
      spC = Math.sin(pit + 0.12)

      // wake-up sizes and fades, the typing heart and the send squeeze
      const wS = C.wakeShell
      const shellM = WAKE.shellFrom + (1 - WAKE.shellFrom) * wS
      const innerM = WAKE.innerFrom + (1 - WAKE.innerFrom) * C.wakeInner
      if (scrollApart) {
        refreshLayout()
        const nowMs = performance.now()
        if (window.scrollY !== lastY) {
          lastY = window.scrollY
          lastMove = nowMs
        }
        scrolling = nowMs - lastMove < SCROLL_RES_HOLD
        setRes(scrolling ? SCROLL_RES : 1)
        const away = clamp01(window.scrollY / Math.max((layout.heroH || window.innerHeight) * 0.7, 1))
        sa += (away - sa) * Math.min(1, dt * 6)
        if (sa < 0.001) sa = 0
        // While the pieces fall they pass in front of the chat panel instead of dimming behind it
        const front = sa > 0.02
        if (front !== inFront && canvas.parentElement) {
          inFront = front
          canvas.parentElement.style.zIndex = front ? '3' : ''
        }
      }
      // Fully scrolled away: every piece has faded out, so draw nothing until it comes back.
      if (scrollApart && sa > 0.995) {
        if (!blank) {
          ctx.clearRect(0, 0, size, size + tail)
          lightRef.current?.(0, inner)
          blank = true
        }
        return
      }
      blank = false
      const outerFade = 1 - sm(0.05, 0.6, sa) // arcs, rings and glow go first
      const innerFade = 1 - sm(0.1, 0.7, sa) // then the glass mass and the heart
      const innerA = Math.min(1, C.wakeInner) * innerFade
      const heartA = (WAKE.heartDim + (1 - WAKE.heartDim) * innerA) * innerFade
      const heartK = 1 + TYPING.heartSwell * C.heart + FLASH.heartSwell * C.flashGlow
      sc =
        (1 + cur.breathe * Math.sin(t * (mode === 'thinking' ? 3.2 : 1.2)) + (mode === 'speaking' ? 0.03 * env : 0)) *
        (1 - CONTRACT.amount * C.squeeze)
      const useWaves = !small && C.waves.length > 0
      const pi = (v, m = innerM) => pr(v, m)

      ctx.clearRect(0, 0, size, size + tail)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // ambient glow (outer: the accent colour)
      ctx.globalAlpha = wS * outerFade
      const gl = 0.16 + 0.1 * env + (mode === 'thinking' ? 0.08 : 0) + FLASH.glow * C.flashGlow
      const gr = R * 1.25 * sc * shellM
      const g = ctx.createRadialGradient(c0, c0, 0, c0, c0, gr)
      g.addColorStop(0, tint(0, 64, gl + 0.12))
      g.addColorStop(0.35, tint(-3, 56, gl * 0.55))
      g.addColorStop(0.8, tint(-6, 50, 0.035))
      g.addColorStop(1, tint(-6, 50, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(c0, c0, gr, 0, TAU)
      ctx.fill()

      // rings travelling out through the shell (typing, and the flash): a faint circle each
      if (useWaves) {
        ctx.lineWidth = 1.2 * k
        for (const w of C.waves) {
          ctx.strokeStyle = tint(0, 72, 0.5 * w.a)
          ctx.beginPath()
          ctx.arc(c0, c0, R * sc * w.r, 0, TAU)
          ctx.stroke()
        }
      }

      // gold shell: streaks (those in front of the glass mass are dimmed so the inside reads)
      const fadeR = R * sc * shellM * SHELL_FADE.inside
      // where the chat panel is, in this canvas (only while the page is scrolling apart)
      const chatBox = sa > 0 ? layout.chatBox : null
      const asm = !small && C.wakeT < 1
      for (const s of shell) {
        const sh = 0.6 + 0.4 * Math.sin(t * 2 + s.ph)
        const len = s.len * (1 + cur.stream * 1.8 * sh) * (1 + 0.5 * env)
        const rr = s.rad + (mode === 'thinking' ? 0.015 * Math.sin(t * 5 + s.ph) : 0)
        const p0 = rot(s.p)
        const p1 = rot(norm([s.p[0] + s.t[0] * len, s.p[1] + s.t[1] * len, s.p[2] + s.t[2] * len]))
        const a = pr([p0[0] * rr, p0[1] * rr, p0[2] * rr], shellM)
        const b = pr([p1[0] * rr, p1[1] * rr, p1[2] * rr], shellM)
        // wake-up: the streak flies in from its scattered spot and settles (hero only)
        let fly = 1
        if (asm) {
          const q = EASE.outCubic(clamp01((C.wakeT - s.d * ASSEMBLE.spread) / (1 - ASSEMBLE.spread)))
          const off = 1 - q
          const dx = (c0 + s.sx * R - a[0]) * off
          const dy = (c0 + s.sy * R - a[1]) * off
          a[0] += dx
          a[1] += dy
          b[0] += dx
          b[1] += dy
          fly = ASSEMBLE.fadeFrom + (1 - ASSEMBLE.fadeFrom) * q
        }
        // scrolling away: this streak peels off in its own time and drifts down, stretching as it goes
        let aw = 0
        if (sa > 0) {
          aw = sm(0, 1, clamp01(sa * 1.7 - s.k * 0.7))
          if (aw > 0) {
            const dx = (DRIFT.right + s.p[0] * DRIFT.spread) * R * aw
            const dy = (DRIFT.down + s.p[2] * DRIFT.spread) * R * aw
            const vx = (b[0] - a[0]) * (1 + DRIFT.stretch * aw)
            const vy = (b[1] - a[1]) * (1 + DRIFT.stretch * aw)
            a[0] += dx
            a[1] += dy
            b[0] = a[0] + vx
            b[1] = a[1] + vy - R * DRIFT.trail * aw // a short tail streaming up behind it
          }
        }
        const fade =
          (p0[2] > 0 && Math.hypot(a[0] - c0, a[1] - c0) < fadeR ? SHELL_FADE.alpha : 1) *
          fly *
          (1 - sm(0.55, 1, aw)) *
          (chatBox && a[0] > chatBox[0] && a[0] < chatBox[2] && a[1] > chatBox[1] && a[1] < chatBox[3]
            ? DRIFT.overChat
            : 1)
        // rings and the flash light the streaks they cross; the flash also holds the whole shell brighter
        let boost = C.uni + DRIFT.glow * aw // falling pieces burn brighter, so they read against the dark
        if (useWaves) {
          const d = Math.hypot(a[0] - c0, a[1] - c0) / (R * sc)
          for (const w of C.waves) boost += w.a * Math.exp(-(((d - w.r) / w.w) ** 2))
        }
        ctx.strokeStyle = tint(
          s.h,
          Math.min(92, s.l + DRIFT.lift * aw),
          Math.min(1, s.a * dA(p0[2]) * (0.55 + 0.45 * sh) * fade * (1 + 2 * boost)),
        )
        ctx.lineWidth = (0.7 + dA(p0[2]) * 0.9) * k * (1 + 0.6 * boost) * (1 + DRIFT.thick * aw)
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }

      // gold shell: circuit arcs (and the tick rings below) sink and fade as the page scrolls
      ctx.globalAlpha = wS * outerFade
      if (!scrollApart || wS * outerFade > 0.01) {
        ctx.save()
        ctx.translate(0, sa * sa * R * 0.9)
        for (const c of arcs) {
          for (const [s0, sp] of c.segs) {
            const st = s0 + t * c.spin
            const n = Math.max(6, Math.round(sp * 14))
            ctx.lineWidth = c.w * k
            ctx.beginPath()
            let zs = 0
            for (let i = 0; i <= n; i++) {
              const th = st + (sp * i) / n
              const cs = Math.cos(th)
              const sn = Math.sin(th)
              const p = rot([
                (c.a[0] * cs + c.b[0] * sn) * c.r,
                (c.a[1] * cs + c.b[1] * sn) * c.r,
                (c.a[2] * cs + c.b[2] * sn) * c.r,
              ])
              const q = pr(p, shellM)
              zs += p[2]
              if (i) ctx.lineTo(q[0], q[1])
              else ctx.moveTo(q[0], q[1])
            }
            ctx.strokeStyle = tint(c.h, 62, c.al * dA(zs / (n + 1)) * (0.8 + 0.2 * env))
            ctx.stroke()
          }
        }

        // gold shell: tick rings
        for (const rg of rings) {
          for (let i = 0; i < rg.ticks; i++) {
            const th = (i / rg.ticks) * TAU + t * rg.spin
            const cs = Math.cos(th)
            const sn = Math.sin(th)
            const d = [rg.a[0] * cs + rg.b[0] * sn, rg.a[1] * cs + rg.b[1] * sn, rg.a[2] * cs + rg.b[2] * sn]
            const L = (i % 5 === 0 ? 0.045 : 0.02) * (1 + 0.5 * env)
            const p0 = rot([d[0] * rg.r, d[1] * rg.r, d[2] * rg.r])
            const p1 = rot([d[0] * (rg.r + L), d[1] * (rg.r + L), d[2] * (rg.r + L)])
            const a = pr(p0, shellM)
            const b = pr(p1, shellM)
            ctx.strokeStyle = tint(0, 66, 0.75 * dA(p0[2]))
            ctx.lineWidth = (i % 5 === 0 ? 1.4 : 0.7) * k
            ctx.beginPath()
            ctx.moveTo(a[0], a[1])
            ctx.lineTo(b[0], b[1])
            ctx.stroke()
          }
        }

        ctx.restore()
      }

      if (!scrollApart || innerFade > 0.01) {
        // =============== the glass mass (inner colour) ===============
        ctx.globalAlpha = innerA
        const O = pi(rotC(HEART), innerM) // the heart, off-centre

        // deep body and a soft inner glow
        const bodyR = R * 0.95 * sc * innerM
        const gb = ctx.createRadialGradient(c0, c0, 0, c0, c0, bodyR)
        gb.addColorStop(0, ic(0.34 + 0.08 * env + 0.08 * act))
        gb.addColorStop(0.6, deep(inner, 0.6, 0.16))
        gb.addColorStop(1, deep(inner, 0.45, 0))
        ctx.fillStyle = gb
        ctx.beginPath()
        ctx.arc(c0, c0, bodyR, 0, TAU)
        ctx.fill()
        const glowR = R * 0.75 * sc * innerM
        const gi = ctx.createRadialGradient(c0, c0, 0, c0, c0, glowR)
        gi.addColorStop(0, ic(0.12 + 0.08 * env + 0.06 * cur.stream + TYPING.glow * C.heart))
        gi.addColorStop(0.6, ic(0.05))
        gi.addColorStop(1, ic(0))
        ctx.fillStyle = gi
        ctx.beginPath()
        ctx.arc(c0, c0, glowR, 0, TAU)
        ctx.fill()

        // soft drifting clouds
        for (const c of clouds) {
          const an = c.ph + t * c.sp
          const q = pi(
            rotC([
              c.p[0] * c.s * (1 + 0.3 * Math.sin(an)),
              c.p[1] * c.s * (1 + 0.3 * Math.cos(an * 1.3)),
              c.p[2] * c.s,
            ]),
          )
          const rr = c.r * R * 1.25 * sc * innerM
          const cg = ctx.createRadialGradient(q[0], q[1], 0, q[0], q[1], rr)
          cg.addColorStop(0, deep(inner, 0.7, 0.16 + 0.06 * act))
          cg.addColorStop(1, deep(inner, 0.5, 0))
          ctx.fillStyle = cg
          ctx.beginPath()
          ctx.arc(q[0], q[1], rr, 0, TAU)
          ctx.fill()
        }

        // translucent glass sheets: shaded skin (brighter toward the rim), fine ribbing, a soft glow,
        // a thin bright edge and, on the hero, dashes flowing along the edge. On wake-up they grow in
        // one after another.
        const sheetN = sheets.length
        for (let si = 0; si < sheetN; si++) {
          const sh = sheets[si]
          const gro = clamp01(C.wakeInner * (1 + MASS.stagger) - (si / sheetN) * MASS.stagger)
          if (gro <= 0) continue
          const sm = innerM * (0.55 + 0.45 * gro)
          ctx.globalAlpha = innerA * gro
          const ang = sh.ph + t * sh.sp * (0.6 + cur.spin)
          const ca = Math.cos(ang)
          const sa = Math.sin(ang)
          const foldAt = (xr, yr) =>
            sh.fold * (Math.sin(xr * 7 + C.mt * 0.8 + sh.ph) + Math.cos(yr * 6 - C.mt * 0.6)) * (1 + 0.3 * act)
          const at = (x, y) => {
            const xr = x * ca - y * sa
            const yr = x * sa + y * ca
            const f = foldAt(xr, yr)
            return pi(
              rotC([
                sh.c[0] + sh.u[0] * xr + sh.v[0] * yr + sh.n[0] * f,
                sh.c[1] + sh.u[1] * xr + sh.v[1] * yr + sh.n[1] * f,
                sh.c[2] + sh.u[2] * xr + sh.v[2] * yr + sh.n[2] * f,
              ]),
              sm,
            )
          }
          const P = []
          let zs = 0
          for (const q of sh.poly) {
            const rr = sh.s * q.r * (1 + 0.08 * Math.sin(C.mt * 0.9 + q.a * 3 + sh.ph))
            const p = at(Math.cos(q.a) * rr, Math.sin(q.a) * rr)
            P.push(p)
          }
          // depth of the sheet from its centre point
          zs = rotC(sh.c)[2]
          const dz = dA(zs)
          const n = P.length
          const path = () => {
            ctx.beginPath()
            for (let i = 0; i < n; i++) {
              const a0 = lp(P[(i + n - 1) % n], P[i], 0.78)
              const b0 = lp(P[i], P[(i + 1) % n], 0.22)
              if (i) ctx.lineTo(a0[0], a0[1])
              else ctx.moveTo(a0[0], a0[1])
              ctx.quadraticCurveTo(P[i][0], P[i][1], b0[0], b0[1])
            }
            ctx.closePath()
          }
          // thin translucent skin, clipped to the sheet
          let cxs = 0
          let cys = 0
          for (const p of P) {
            cxs += p[0]
            cys += p[1]
          }
          cxs /= n
          cys /= n
          let ext = 1
          for (const p of P) ext = Math.max(ext, Math.hypot(p[0] - cxs, p[1] - cys))
          ctx.save()
          path()
          ctx.clip()
          const sg = ctx.createRadialGradient(cxs, cys, 0, cxs, cys, ext)
          sg.addColorStop(0, ic(0.035 * sh.al * dz))
          sg.addColorStop(0.6, ic(0.1 * sh.al * dz))
          sg.addColorStop(1, iw(0.3, 0.3 * sh.al * dz))
          ctx.fillStyle = sg
          ctx.fillRect(cxs - ext, cys - ext, ext * 2, ext * 2)
          if (!small) {
            ctx.beginPath()
            for (let j = -3; j <= 3; j++) {
              const y0 = j * sh.s * 0.3
              for (let i = 0; i <= 8; i++) {
                const q = at(((i / 8) * 2 - 1) * sh.s * 1.35, y0)
                if (i) ctx.lineTo(q[0], q[1])
                else ctx.moveTo(q[0], q[1])
              }
            }
            ctx.strokeStyle = iw(0.45, (0.14 + 0.1 * act) * dz)
            ctx.lineWidth = 0.6 * ki
            ctx.stroke()
          }
          ctx.restore()
          // glow, then the thin bright edge
          path()
          ctx.strokeStyle = ic(0.09 * dz)
          ctx.lineWidth = 7 * ki
          ctx.stroke()
          path()
          ctx.strokeStyle = iw(
            0.25 + 0.4 * act * sh.al,
            Math.min(1, (0.45 + 0.4 * sh.al + 0.2 * act + (sh.big ? 0.15 : 0)) * dz),
          )
          ctx.lineWidth = ((sh.big ? 1.5 : 1) + 0.5 * sh.al) * ki
          ctx.stroke()
          // dashes flowing along the edge (hero only)
          if (!small) {
            path()
            ctx.setLineDash(DASHES.map((d) => d * k))
            ctx.lineDashOffset = -C.dash * k * (sh.sp > 0 ? 1 : -1)
            ctx.strokeStyle = iw(0.8, Math.min(1, (0.55 + 0.3 * act) * dz))
            ctx.lineWidth = 1.7 * ki
            ctx.stroke()
            ctx.setLineDash(NO_DASH)
          }
        }
        ctx.globalAlpha = innerA

        // fine light scratches, flickering with the state's act
        for (const sc2 of scratches) {
          const fl = Math.pow(Math.max(0, Math.sin(t * sc2.sp + sc2.ph)), 2.5)
          const hh = sc2.h * (1 + 0.3 * fl)
          const p0 = rotC([sc2.c[0] - sc2.dir[0] * hh, sc2.c[1] - sc2.dir[1] * hh, sc2.c[2] - sc2.dir[2] * hh])
          const p1 = rotC([sc2.c[0] + sc2.dir[0] * hh, sc2.c[1] + sc2.dir[1] * hh, sc2.c[2] + sc2.dir[2] * hh])
          const a = pi(p0)
          const b = pi(p1)
          const al = (sc2.al * (0.3 + 0.5 * act) + fl * 0.4) * dA((p0[2] + p1[2]) / 2)
          ctx.strokeStyle = iw(0.4 + fl * 0.45, Math.min(1, al))
          ctx.lineWidth = sc2.w * ki * (1 + fl * 0.8)
          ctx.beginPath()
          ctx.moveTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
          ctx.stroke()
        }

        // two thin wobbling rim loops, bright where the membrane folds (hero only)
        for (const rm of rims) {
          let prev = null
          for (let i = 0; i <= 96; i++) {
            const ph = (i / 96) * TAU
            const rr =
              R *
              sc *
              innerM *
              rm.r *
              (1 +
                0.1 * Math.sin(rm.m * ph + rm.ph + C.mt * 0.6) +
                0.05 * Math.sin(rm.m2 * ph + rm.ph2 - C.mt * 0.8) +
                0.04 * env)
            const pt = [c0 + rm.off[0] * R + Math.cos(ph) * rr, c0 + rm.off[1] * R + Math.sin(ph) * rr * 0.96]
            if (prev) {
              const b0 = Math.pow(0.5 + 0.5 * Math.sin(3 * ph + rm.ph * 2 + C.mt * 0.7), 2)
              ctx.strokeStyle = iw(0.15 + 0.4 * b0, 0.14 + 0.55 * b0 * (0.7 + 0.3 * act))
              ctx.lineWidth = rm.w * k * (0.35 + 0.5 * b0)
              ctx.beginPath()
              ctx.moveTo(prev[0], prev[1])
              ctx.lineTo(pt[0], pt[1])
              ctx.stroke()
            }
            prev = pt
          }
        }

        // the heart: streaks, a halo and the white-hot centre. It is dim but already there on wake-up.
        ctx.globalAlpha = heartA
        for (const ry of rays) {
          const fl = Math.pow(Math.max(0, Math.sin(t * ry.sp + ry.ph)), 2)
          const l2 = ry.len * (0.7 + 0.5 * fl + 0.3 * act)
          const q = pi(rotC([HEART[0] + ry.dir[0] * l2, HEART[1] + ry.dir[1] * l2, HEART[2] + ry.dir[2] * l2]))
          ctx.strokeStyle = iw(0.6, (0.15 + 0.5 * fl) * (0.5 + 0.5 * act))
          ctx.lineWidth = (0.8 + fl) * ki
          ctx.beginPath()
          ctx.moveTo(O[0], O[1])
          ctx.lineTo(q[0], q[1])
          ctx.stroke()
        }
        const haloR = R * 0.6 * sc * innerM
        const mg = ctx.createRadialGradient(O[0], O[1], 0, O[0], O[1], haloR)
        mg.addColorStop(0, iw(0.45, 0.3 + 0.1 * act + TYPING.glow * C.heart))
        mg.addColorStop(1, ic(0))
        ctx.fillStyle = mg
        ctx.beginPath()
        ctx.arc(O[0], O[1], haloR, 0, TAU)
        ctx.fill()
        const nr = R * 0.34 * sc * innerM * (1 + 0.3 * env + 0.12 * cur.stream * Math.sin(t * 9)) * heartK
        const ng = ctx.createRadialGradient(O[0], O[1], 0, O[0], O[1], nr)
        ng.addColorStop(0, 'rgba(255,255,255,1)')
        ng.addColorStop(0.2, iw(0.65, 0.8))
        ng.addColorStop(0.55, ic(0.25))
        ng.addColorStop(1, ic(0))
        ctx.fillStyle = ng
        ctx.beginPath()
        ctx.arc(O[0], O[1], nr, 0, TAU)
        ctx.fill()
        ctx.globalAlpha = innerA

        // energy bolts from the heart, and the thinking pulses (longer bolts that travel to the shell)
        if (!small) {
          for (const bo of C.bolts) {
            const q = bo.pts.map((p) => pi(rotC(p)))
            for (const [w, col] of [
              [5, iw(0, 0.2 * bo.k)],
              [1.5, iw(0.7, 0.9 * bo.k)],
            ]) {
              ctx.strokeStyle = col
              ctx.lineWidth = w * ki
              ctx.beginPath()
              q.forEach((p, j) => {
                if (j) ctx.lineTo(p[0], p[1])
                else ctx.moveTo(p[0], p[1])
              })
              ctx.stroke()
            }
          }
          for (const pu of C.pulses) {
            const u1 = 0.04 + 0.97 * pu.p
            const u0 = Math.max(0.04, u1 - THINK.trail)
            const al = Math.min(pu.p / 0.1, 1) * (1 - Math.max(0, (pu.p - 0.75) / 0.25))
            const q = []
            for (let i = 0; i < 7; i++) {
              const u = u0 + ((u1 - u0) * i) / 6
              const j = i === 0 || i === 6 ? 0 : 0.045
              q.push(pi(rotC(HEART.map((h, a) => h + (pu.dir[a] * 0.98 - h) * u + pu.jit[i][a] * j))))
            }
            for (const [w, col] of [
              [5, iw(0, 0.18 * al)],
              [THINK.width, iw(0.7, 0.9 * al)],
            ]) {
              ctx.strokeStyle = col
              ctx.lineWidth = w * ki
              ctx.beginPath()
              q.forEach((p, j) => {
                if (j) ctx.lineTo(p[0], p[1])
                else ctx.moveTo(p[0], p[1])
              })
              ctx.stroke()
            }
          }

          // cyan glitter drifting around the mass
          for (const spl of sparklets) {
            const tw = Math.pow(Math.max(0, Math.sin(t * spl.sp + spl.ph)), 2)
            const base = [spl.d[0] * spl.r, spl.d[1] * spl.r, spl.d[2] * spl.r]
            const p0 = rotC(base)
            const p1 = rotC([base[0] + spl.t[0] * spl.h, base[1] + spl.t[1] * spl.h, base[2] + spl.t[2] * spl.h])
            const a = pi(p0)
            const b = pi(p1)
            ctx.strokeStyle = iw(0.3 + tw * 0.6, (0.12 + tw * 0.75) * dA(p0[2]) * (0.55 + act * 0.45))
            ctx.lineWidth = (0.7 + tw * 0.9) * ki
            ctx.beginPath()
            ctx.moveTo(a[0], a[1])
            ctx.lineTo(b[0], b[1])
            ctx.stroke()
          }

          // glittering dust
          for (const d of dust) {
            const tw = Math.pow(Math.max(0, Math.sin(t * d.sp + d.ph)), 2)
            const p = rotC([d.p[0] + 0.02 * Math.sin(t * 0.8 + d.ph), d.p[1] + 0.02 * Math.cos(t * 0.7 + d.ph), d.p[2]])
            const q = pi(p)
            ctx.fillStyle = iw(0.4 + tw * 0.5, (0.12 + tw * 0.7) * dA(p[2]) * (0.5 + act * 0.5))
            ctx.beginPath()
            ctx.arc(q[0], q[1], d.s * k * (0.7 + tw * 0.8), 0, TAU)
            ctx.fill()
          }
        }
      }

      // electric sparks off the rim (the contrasting accent; gold while thinking so they read)
      ctx.globalAlpha = wS * outerFade
      if (Math.random() < cur.spark * dt * 2.2) {
        const o = randUnit()
        const pts = []
        for (let i = 0; i < 9; i++) {
          pts.push([
            o[0] * (1 + i * 0.035) + rnd(-0.03, 0.03),
            o[1] * (1 + i * 0.035) + rnd(-0.03, 0.03),
            o[2] * (1 + i * 0.035) + rnd(-0.03, 0.03),
          ])
        }
        const l = rnd(0.12, 0.3)
        sparks.push({ pts, life: l, max: l, gold: mode === 'thinking' })
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= dt
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        const kk = s.life / s.max
        ctx.strokeStyle = s.gold ? `${SPARK_GOLD}${kk})` : mix(inner, 0.35, kk)
        ctx.lineWidth = 1.4 * k
        ctx.beginPath()
        s.pts.forEach((v, j) => {
          const q = pr(rot(v))
          if (j) ctx.lineTo(q[0], q[1])
          else ctx.moveTo(q[0], q[1])
        })
        ctx.stroke()
        ctx.strokeStyle = `rgba(255,255,255,${kk * 0.8})`
        ctx.lineWidth = 0.6 * k
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      if (!small) lightRef.current?.(C.light * innerFade, inner)
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      C.tick(performance.now())
      draw(C.dt) // one static frame
    } else {
      const loop = (now) => {
        const dt = C.tick(now) // the first orb to call this frame advances the shared clock
        if (visible && !document.hidden) {
          // while scrolling, every other frame is skipped (the time it owes is added to the next one)
          owedDt += dt
          skipFrame = scrolling && !skipFrame
          if (!skipFrame) {
            draw(owedDt)
            owedDt = 0
          }
        }
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(canvas)

    return () => {
      if (inFront && canvas.parentElement) canvas.parentElement.style.zIndex = ''
      cancelAnimationFrame(raf)
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('theme-change', onTheme)
      window.removeEventListener('pointermove', onMove)
    }
  }, [size, density, ticks, scrollApart, tail, onFail])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size + tail, pointerEvents: 'none', ...style }}
    />
  )
}
