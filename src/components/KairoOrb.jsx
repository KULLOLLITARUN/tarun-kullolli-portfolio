import { useEffect, useRef } from 'react'
import { orbController } from '../orb/orbController.js'
import { CONTRACT, FLASH, SMALL_MAX, THINK, TYPING, WAKE } from '../orb/orbTheme.js'

// Kairo's holographic orb. The outer layers (shell streaks, arcs, tick rings, outer glow) take the
// site's accent colour (--accent-rgb) in every state; only the inner parts (spiral core, nucleus,
// swoosh, inner glow) change colour with the state, through one eased RGB value.
// It is made of additive light streaks, circuit arcs, clockwork tick rings, a
// spiral-galaxy core, a bright nucleus, a swoosh ribbon and the odd cyan spark, all on a
// transparent Canvas 2D. Decorative only (aria-hidden); the chat announces its own status.
// Its state, clock and event animations (wake-up, typing, send, thinking, flash, speaking) come from
// the shared orb/orbController.js, with every timing in orb/orbTheme.js, so the hero orb and the
// header avatar move together. Canvases of SMALL_MAX px or less get the simplified versions.

const TAU = Math.PI * 2
const rnd = (a, b) => a + Math.random() * (b - a)
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
// An inner element's colour: the inner colour mixed toward white by w (0 = inner, 1 = white).
const mix = (c, w, a) =>
  `rgba(${Math.round(c[0] * (1 - w) + 255 * w)},${Math.round(c[1] * (1 - w) + 255 * w)},${Math.round(c[2] * (1 - w) + 255 * w)},${a})`

// onFail is called if the canvas cannot draw, so the caller can bring Kairo's own art back.
export default function KairoOrb({ size = 310, density = 1, ticks = true, onFail, className, style }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      onFail?.()
      return
    }

    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = canvas.height = Math.round(size * DPR)
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0)

    const c0 = size / 2
    const R = size * 0.4
    const k = Math.max(0.4, Math.min(1.3, R / 170))
    const small = size <= SMALL_MAX // the avatar: no rings or travelling pulses

    // ---- colour: re-read when the theme changes -------------------------
    let pal = readAccent()
    const onTheme = () => {
      pal = readAccent()
    }
    window.addEventListener('theme-change', onTheme)
    const mo = new MutationObserver(onTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme', 'class'] })
    // dh is the hue offset from the accent (the old gold spread was about +-7 degrees)
    const tint = (dh, l, a) => `hsla(${pal.h + dh},${pal.s}%,${l}%,${a})`

    // ---- geometry ----------------------------------------------------
    const shell = Array.from({ length: Math.round(1700 * density) }, () => {
      const p = randUnit()
      return {
        p,
        t: tangentAt(p),
        len: rnd(0.012, 0.075),
        h: rnd(-7, 7),
        l: rnd(55, 76),
        a: rnd(0.25, 1),
        rad: rnd(0.95, 1.05),
        ph: rnd(0, TAU),
      }
    })

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
        r: rnd(0.5, 1.03),
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

    const cN = norm([0.35, 1, 0.25])
    const cA = tangentAt(cN)
    const cB = cross(cN, cA)
    const coreCount = Math.max(60, Math.round(520 * density))
    const core = Array.from({ length: coreCount }, (_, i) => {
      const kk = i / coreCount
      return {
        th: kk * 11 + (i % 2) * Math.PI,
        r: 0.02 + Math.pow(kk, 0.85) * 0.5,
        y: rnd(-0.015, 0.015),
        s: rnd(0.8, 2),
        a: 1 - kk * 0.7,
      }
    })

    const swN = norm([0.5, 0.6, 1])
    const swA = tangentAt(swN)
    const sw = { r: 0.46, a: swA, b: cross(swN, swA) }

    const sparks = []

    // ---- projection --------------------------------------------------
    let cy_ = 1
    let sy_ = 0
    let cp_ = 1
    let sp_ = 0
    let sc = 1
    const rot = (v) => {
      const x = v[0] * cy_ + v[2] * sy_
      const z = -v[0] * sy_ + v[2] * cy_
      return [x, v[1] * cp_ - z * sp_, v[1] * sp_ + z * cp_]
    }
    const pr = (v, m = 1) => {
      const f = (1 / (1 - v[2] * 0.12)) * sc * m
      return [c0 + v[0] * R * f, c0 + v[1] * R * f]
    }
    const dA = (z) => 0.3 + (0.7 * (z + 1)) / 2

    // ---- loop state --------------------------------------------------
    const C = orbController // the shared clock, state and events (orb/orbController.js)
    let mx = 0
    let my = 0
    const tilt = [0, 0]
    let raf = 0
    let visible = true

    const onMove = (e) => {
      mx = e.clientX / window.innerWidth - 0.5
      my = e.clientY / window.innerHeight - 0.5
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const draw = (dt) => {
      const { cur, inner, t, mode, env } = C
      tilt[0] += (my * 0.7 - tilt[0]) * 0.05
      tilt[1] += (mx * 0.9 - tilt[1]) * 0.05
      cy_ = Math.cos(C.yaw + tilt[1])
      sy_ = Math.sin(C.yaw + tilt[1])
      const pit = -0.28 + tilt[0]
      cp_ = Math.cos(pit)
      sp_ = Math.sin(pit)

      // wake-up sizes and fades, the typing heart and the send squeeze
      const wS = C.wakeShell
      const shellM = WAKE.shellFrom + (1 - WAKE.shellFrom) * wS
      const innerM = WAKE.innerFrom + (1 - WAKE.innerFrom) * C.wakeInner
      const innerA = Math.min(1, C.wakeInner)
      const heartA = WAKE.heartDim + (1 - WAKE.heartDim) * innerA
      const heartK = 1 + TYPING.heartSwell * C.heart + FLASH.heartSwell * C.flashGlow
      sc =
        (1 + cur.breathe * Math.sin(t * (mode === 'thinking' ? 3.2 : 1.2)) + (mode === 'speaking' ? 0.03 * env : 0)) *
        (1 - CONTRACT.amount * C.squeeze)
      const useWaves = !small && C.waves.length > 0

      ctx.clearRect(0, 0, size, size)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'

      // ambient glow (outer: the accent colour)
      ctx.globalAlpha = wS
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

      // soft inner glow behind the core, in the inner colour
      ctx.globalAlpha = innerA
      const igr = R * 0.55 * sc * innerM
      const ig = ctx.createRadialGradient(c0, c0, 0, c0, c0, igr)
      ig.addColorStop(0, mix(inner, 0, 0.22 + 0.1 * env + TYPING.glow * C.heart))
      ig.addColorStop(1, mix(inner, 0, 0))
      ctx.fillStyle = ig
      ctx.beginPath()
      ctx.arc(c0, c0, igr, 0, TAU)
      ctx.fill()

      ctx.globalAlpha = wS
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

      // shell streaks
      for (const s of shell) {
        const sh = 0.6 + 0.4 * Math.sin(t * 2 + s.ph)
        const len = s.len * (1 + cur.stream * 1.8 * sh) * (1 + 0.5 * env)
        const rr = s.rad + (mode === 'thinking' ? 0.015 * Math.sin(t * 5 + s.ph) : 0)
        const p0 = rot(s.p)
        const p1 = rot(norm([s.p[0] + s.t[0] * len, s.p[1] + s.t[1] * len, s.p[2] + s.t[2] * len]))
        const a = pr([p0[0] * rr, p0[1] * rr, p0[2] * rr], shellM)
        const b = pr([p1[0] * rr, p1[1] * rr, p1[2] * rr], shellM)
        // rings and the flash light the streaks they cross; the flash also holds the whole shell brighter
        let boost = C.uni
        if (useWaves) {
          const d = Math.hypot(a[0] - c0, a[1] - c0) / (R * sc)
          for (const w of C.waves) boost += w.a * Math.exp(-(((d - w.r) / w.w) ** 2))
        }
        ctx.strokeStyle = tint(s.h, s.l, Math.min(1, s.a * dA(p0[2]) * (0.55 + 0.45 * sh) * (1 + 2 * boost)))
        ctx.lineWidth = (0.7 + dA(p0[2]) * 0.9) * k * (1 + 0.6 * boost)
        ctx.beginPath()
        ctx.moveTo(a[0], a[1])
        ctx.lineTo(b[0], b[1])
        ctx.stroke()
      }

      // circuit arcs
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

      // tick rings
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

      // spiral core
      ctx.globalAlpha = innerA
      const cs_ = t * (0.5 + cur.spin * 0.8)
      for (const c of core) {
        const th = c.th + cs_ * (1.2 - c.r)
        const cs = Math.cos(th)
        const sn = Math.sin(th)
        const q = pr(
          rot([
            (cA[0] * cs + cB[0] * sn) * c.r + cN[0] * c.y,
            (cA[1] * cs + cB[1] * sn) * c.r + cN[1] * c.y,
            (cA[2] * cs + cB[2] * sn) * c.r + cN[2] * c.y,
          ]),
          innerM,
        )
        ctx.fillStyle = mix(inner, (10 + (1 - c.r) * 25) / 50, c.a * 0.9)
        ctx.beginPath()
        ctx.arc(q[0], q[1], c.s * k * (1 + (1 - c.r) * 0.8), 0, TAU)
        ctx.fill()
      }

      // nucleus
      ctx.globalAlpha = 1
      const nr = R * 0.17 * innerM * (1 + 0.3 * env) * heartK
      const ng = ctx.createRadialGradient(c0, c0, 0, c0, c0, nr)
      ng.addColorStop(0, mix(inner, 0.7, 0.95 * heartA)) // the inner colour, about 70% toward white
      ng.addColorStop(0.3, mix(inner, 0.34, 0.5 * heartA))
      ng.addColorStop(1, mix(inner, 0.12, 0))
      ctx.fillStyle = ng
      ctx.beginPath()
      ctx.arc(c0, c0, nr, 0, TAU)
      ctx.fill()

      // thinking: a few pulses of light travel from the heart out to the shell
      ctx.globalAlpha = innerA
      if (!small) {
        for (const q of C.pulses) {
          const r1 = 0.04 + 0.97 * q.p
          const r0 = Math.max(0.04, r1 - THINK.trail)
          const al = Math.min(q.p / 0.1, 1) * (1 - Math.max(0, (q.p - 0.75) / 0.25))
          const a = pr(rot([q.dir[0] * r0, q.dir[1] * r0, q.dir[2] * r0]))
          const b = pr(rot([q.dir[0] * r1, q.dir[1] * r1, q.dir[2] * r1]))
          ctx.strokeStyle = mix(inner, 0.55, al * 0.9)
          ctx.lineWidth = THINK.width * k
          ctx.beginPath()
          ctx.moveTo(a[0], a[1])
          ctx.lineTo(b[0], b[1])
          ctx.stroke()
          ctx.fillStyle = mix(inner, 0.8, al)
          ctx.beginPath()
          ctx.arc(b[0], b[1], 1.7 * k, 0, TAU)
          ctx.fill()
        }
      }

      // swoosh ribbon: wide and soft, then thin and crisp
      for (const [w, al] of [
        [7, 0.12],
        [2.4, 0.75],
      ]) {
        ctx.lineWidth = w * k
        ctx.strokeStyle = mix(inner, 0.3, al)
        ctx.beginPath()
        for (let i = 0; i <= 60; i++) {
          const th = 0.5 + (3.3 * i) / 60 - t * 0.25
          const cs = Math.cos(th)
          const sn = Math.sin(th)
          const rr = sw.r * (0.75 + (0.25 * i) / 60)
          const q = pr(
            rot([
              (sw.a[0] * cs + sw.b[0] * sn) * rr,
              (sw.a[1] * cs + sw.b[1] * sn) * rr,
              (sw.a[2] * cs + sw.b[2] * sn) * rr,
            ]),
            innerM,
          )
          if (i) ctx.lineTo(q[0], q[1])
          else ctx.moveTo(q[0], q[1])
        }
        ctx.stroke()
      }

      // electric sparks (the cyan accent)
      ctx.globalAlpha = wS
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
        ctx.strokeStyle = s.gold ? `${SPARK_GOLD}${kk})` : `hsla(${pal.h + 180},100%,72%,${kk})`
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
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      C.tick(performance.now())
      draw(C.dt) // one static frame
    } else {
      const loop = (now) => {
        const dt = C.tick(now) // the first orb to call this frame advances the shared clock
        if (visible && !document.hidden) draw(dt)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(canvas)

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      mo.disconnect()
      window.removeEventListener('theme-change', onTheme)
      window.removeEventListener('pointermove', onMove)
    }
  }, [size, density, ticks, onFail])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, pointerEvents: 'none', ...style }}
    />
  )
}
