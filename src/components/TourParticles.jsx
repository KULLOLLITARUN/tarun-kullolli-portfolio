import { useEffect, useRef } from 'react'
import { orbController } from '../orb/orbController.js'
import { ASSEMBLE, EASE } from '../orb/orbTheme.js'

// The orb turns into Kairo for the tour. When the tour starts, particles lift off the orb's shell
// and fly to the docked guide Kairo, which fades in as they land (--kairo-form, read by
// .mascot.is-orb.is-touring in styles.css). When the tour ends they fly back and the orb re-forms.
// One fixed full-window canvas, drawn only while a flight is running. Decorative (aria-hidden).

const TAU = Math.PI * 2
const COUNT = 800
const DURATION = 1.9 // seconds for the whole flight
const GATHER_COUNT = 700
const SPREAD = 0.4 // particles leave over this fraction of it, so they stream
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const inOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const smooth = (x) => x * x * (3 - 2 * x)
const rnd = (a, b) => a + Math.random() * (b - a)
// A short spark: the trail behind a particle is capped at TRAIL px, so fast ones do not turn into needles.
const TRAIL = 9
const trail = (from, to) => {
  const dx = from[0] - to[0]
  const dy = from[1] - to[1]
  const l = Math.hypot(dx, dy)
  return l > TRAIL ? [to[0] + (dx / l) * TRAIL, to[1] + (dy / l) * TRAIL] : from
}

// Kairo's body in the guide drawing (viewBox 320x400): dial centre (160,175), body radius 105.
const BODY = { cx: 0.5, cy: 175 / 400, r: 105 / 400 }

function accent() {
  try {
    const p = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-rgb')
      .split(',')
      .map((x) => parseFloat(x))
    if (p.length >= 3 && p.slice(0, 3).every((x) => x >= 0 && x <= 255)) return p
  } catch {
    /* fall through */
  }
  return [245, 181, 68]
}

export default function TourParticles() {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let w = 0
    let h = 0
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    fit()
    window.addEventListener('resize', fit)

    let parts = []
    let rgb = accent()
    let p = 0 // 0 = the orb, 1 = all of it is Kairo
    let goal = 0
    let raf = 0
    let last = 0
    // The intro: when the chat wakes, white particles lift off the name and gather into the orb.
    let gStart = 0 // when the gathering began (ms); its progress is the orb's own wakeT, so both land together
    let gOn = false
    let gather = []
    let kairo = null // { x, y, h }: the docked guide's body centre and the drawing's height (px)

    const orbRect = () => document.querySelector('.kairo-orb-hero canvas')?.getBoundingClientRect()
    const setForm = (v) => document.documentElement.style.setProperty('--kairo-form', v)

    // Particles start on the orb's shell (a random point on the sphere, turned by the orb's yaw)
    // and end somewhere on Kairo's body disc.
    const build = () => {
      const yaw = orbController.yaw
      const cy = Math.cos(yaw)
      const sy = Math.sin(yaw)
      const pit = -0.28
      const cp = Math.cos(pit)
      const sp = Math.sin(pit)
      parts = Array.from({ length: COUNT }, () => {
        const u = rnd(-1, 1)
        const a = rnd(0, TAU)
        const s = Math.sqrt(1 - u * u)
        const v = [s * Math.cos(a), u, s * Math.sin(a)]
        const x = v[0] * cy + v[2] * sy
        const z = -v[0] * sy + v[2] * cy
        const rr = Math.sqrt(Math.random()) * BODY.r
        const th = rnd(0, TAU)
        return {
          ox: x,
          oy: v[1] * cp - z * sp,
          oz: v[1] * sp + z * cp,
          kx: Math.cos(th) * rr, // where it lands, as a fraction of the drawing's height
          ky: Math.sin(th) * rr,
          d: Math.random(),
          bend: rnd(-0.35, 0.35),
          size: rnd(0.8, 2),
          a: rnd(0.5, 1),
        }
      })
    }

    const buildGather = () => {
      const n = document.querySelector('.hero-name')?.getBoundingClientRect()
      if (!n || !n.width) return false
      const yaw = orbController.yaw
      gather = Array.from({ length: GATHER_COUNT }, () => {
        const u = rnd(-1, 1)
        const a = rnd(0, TAU)
        const s = Math.sqrt(1 - u * u)
        const v = [s * Math.cos(a), u, s * Math.sin(a)]
        return {
          sx: n.left + Math.random() * n.width,
          sy: n.top + Math.random() * n.height,
          ox: v[0] * Math.cos(yaw) + v[2] * Math.sin(yaw),
          oy: v[1] * 0.96,
          oz: -v[0] * Math.sin(yaw) + v[2] * Math.cos(yaw),
          d: Math.random(),
          bend: rnd(-0.3, 0.3),
          size: rnd(1, 2.4),
          a: rnd(0.6, 1),
        }
      })
      return true
    }

    const drawGather = (o) => {
      const R = o.width * 0.4
      const cx = o.left + o.width / 2
      const cy = o.top + o.height / 2
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      for (const q of gather) {
        const k = clamp01((orbController.wakeT - q.d * ASSEMBLE.spread) / (1 - ASSEMBLE.spread))
        if (k >= 1) continue
        const f = 1 / (1 - q.oz * 0.12)
        const ex = cx + q.ox * R * f
        const ey = cy + q.oy * R * f
        const at = (kk) => {
          const e = EASE.outCubic(kk)
          const sw = Math.sin(kk * Math.PI) * q.bend * Math.hypot(ex - q.sx, ey - q.sy)
          const nx = -(ey - q.sy)
          const ny = ex - q.sx
          const nl = Math.hypot(nx, ny) || 1
          return [q.sx + (ex - q.sx) * e + (nx / nl) * sw, q.sy + (ey - q.sy) * e + (ny / nl) * sw]
        }
        const [x, y] = at(k)
        const al = q.a * (k <= 0 ? 0.5 : clamp01(k / 0.1)) * clamp01((1 - k) / 0.15)
        ctx.strokeStyle = `rgba(255,248,235,${al})`
        ctx.fillStyle = ctx.strokeStyle
        if (k <= 0) {
          ctx.beginPath()
          ctx.arc(x, y, q.size * 0.7, 0, TAU)
          ctx.fill()
        } else {
          const [x0, y0] = trail(at(Math.max(0, k - 0.02)), [x, y])
          ctx.lineWidth = q.size
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    const frame = (now) => {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016
      last = now
      p = goal > p ? Math.min(goal, p + dt / DURATION) : Math.max(goal, p - dt / DURATION)

      // The guide Kairo's position is read every frame: it flies in from the hero and parks.
      const m = document.querySelector('.mascot.is-touring')
      if (m) {
        const r = m.getBoundingClientRect()
        if (r.height > 0) kairo = { x: r.left + r.width * BODY.cx, y: r.top + r.height * BODY.cy, h: r.height }
      }
      const o = orbRect()
      ctx.clearRect(0, 0, w, h)
      if (o && kairo) {
        const R = o.width * 0.4
        const cx = o.left + o.width / 2
        const cy = o.top + o.height / 2
        ctx.globalCompositeOperation = 'lighter'
        ctx.lineCap = 'round'
        const [r0, g0, b0] = rgb
        for (const q of parts) {
          const at = (k) => {
            const e = inOut(k)
            const fx = 1 / (1 - q.oz * 0.12)
            const sx = cx + q.ox * R * fx
            const sy = cy + q.oy * R * fx
            const ex = kairo.x + q.kx * kairo.h
            const ey = kairo.y + q.ky * kairo.h
            // a curved path: swing out to the side in the middle of the flight
            const sw = Math.sin(k * Math.PI) * q.bend * Math.hypot(ex - sx, ey - sy)
            const nx = -(ey - sy)
            const ny = ex - sx
            const nl = Math.hypot(nx, ny) || 1
            return [sx + (ex - sx) * e + (nx / nl) * sw, sy + (ey - sy) * e + (ny / nl) * sw]
          }
          const k = clamp01((p - q.d * SPREAD) / (1 - SPREAD))
          if (k >= 1) continue // already part of Kairo
          if (k <= 0) {
            // still waiting on the shell: the orb is fading out, so hold a dot there until its turn
            const [x, y] = at(0)
            ctx.fillStyle = `rgba(${Math.round(r0 + (255 - r0) * 0.35)},${Math.round(g0 + (255 - g0) * 0.35)},${Math.round(b0 + (255 - b0) * 0.35)},${q.a * 0.7})`
            ctx.beginPath()
            ctx.arc(x, y, q.size * 0.8, 0, TAU)
            ctx.fill()
            continue
          }
          const [x, y] = at(k)
          const [x0, y0] = trail(at(Math.max(0, k - 0.05)), [x, y])
          const al = q.a * clamp01(k / 0.12) * clamp01((1 - k) / 0.18)
          ctx.strokeStyle = `rgba(${Math.round(r0 + (255 - r0) * 0.35)},${Math.round(g0 + (255 - g0) * 0.35)},${Math.round(b0 + (255 - b0) * 0.35)},${al})`
          ctx.lineWidth = q.size
          ctx.beginPath()
          ctx.moveTo(x0, y0)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        ctx.globalCompositeOperation = 'source-over'
      }
      if (gOn && o) drawGather(o)
      if (gOn && orbController.wakeT >= 1 && now - gStart > 400) gOn = false
      // Kairo forms as the last particles land (the CSS reads this variable)
      if (p !== 0 || goal !== 0) setForm(smooth(clamp01((p - 0.55) / 0.4)).toFixed(3))

      if (p === goal && !gOn) {
        raf = 0
        last = 0
        ctx.clearRect(0, 0, w, h)
        canvas.style.display = 'none'
        if (goal === 0) document.documentElement.style.removeProperty('--kairo-form')
        return
      }
      raf = requestAnimationFrame(frame)
    }
    const run = () => {
      canvas.style.display = 'block'
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const onTour = () => {
      if (goal === 1) return // a step change inside the tour: the flight already ran
      rgb = accent()
      if (p === 0) build()
      goal = 1
      setForm(p === 0 ? '0' : smooth(clamp01((p - 0.55) / 0.4)).toFixed(3)) // Kairo mounts hidden
      run()
    }
    const onEnd = () => {
      if (goal === 0) return
      goal = 0
      run()
    }
    const onWake = () => {
      if (!buildGather()) return
      gStart = performance.now()
      gOn = true
      run()
    }
    window.addEventListener('orb-wake', onWake)
    window.addEventListener('kairo-tour', onTour)
    window.addEventListener('kairo-tour-end', onEnd)

    return () => {
      window.removeEventListener('orb-wake', onWake)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
      window.removeEventListener('kairo-tour', onTour)
      window.removeEventListener('kairo-tour-end', onEnd)
      document.documentElement.style.removeProperty('--kairo-form')
    }
  }, [])

  return <canvas ref={ref} className="tour-particles" aria-hidden="true" />
}
