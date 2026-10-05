import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { faceState } from '../chat/faceState.js'
import { useReducedMotion } from '../hooks.js'
import { availableThemes, setTheme, themeState } from '../theme.js'

// "Kairo" — an original rubber-hose alarm-clock character drawn in SVG.
// Eyes follow the cursor, it blinks, waves, talks with the chat, and its
// clock hands show the visitor's real local time. Click it and the alarm rings and a picker
// offers the time-of-day themes (theme.js), it dozes off after 30s without input,
// glances down after the particles when the page scrolls, and nods after answering.
// While an answer loads it thinks (hand on chin, thought dots, hands spinning); off-topic
// questions in a row make it confused, then annoyed, then grumpy, and a good question
// afterwards cheers it up again.

const SLEEP_MS = 30000
const RING_MS = 900
const COOL_MS = 20000 // a bad mood eases one level after this long without another miss

const C = { x: 160, y: 175 } // dial centre
const EYES = [
  { x: 128, y: 158 },
  { x: 192, y: 158 },
]
const INK = '#0b1324'

// Arm poses: shoulder, two curve controls, hand end, and the glove (x, y, rotation).
const POSE = {
  leftHip: [66, 200, 30, 206, 26, 238, 50, 256, 56, 258, -130],
  leftChin: [70, 206, 44, 250, 80, 292, 121, 276, 126, 262, 18],
  rightWave: [256, 168, 290, 158, 300, 128, 292, 98, 292, 86, 8],
  rightHip: [254, 200, 290, 206, 294, 238, 270, 256, 264, 258, 130],
}
const lerpPose = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
const armD = (p) => `M${p[0]},${p[1]} C${p[2]},${p[3]} ${p[4]},${p[5]} ${p[6]},${p[7]}`
const gloveT = (p) => `translate(${p[8]} ${p[9]}) rotate(${p[10]})`

function Glove({ pose, ref }) {
  return (
    <g ref={ref} transform={gloveT(pose)}>
      {/* cuff */}
      <rect x="-13" y="10" width="26" height="10" rx="4" fill="#fff" stroke={INK} strokeWidth="4" />
      {/* fingers */}
      <rect x="-14" y="-24" width="9" height="22" rx="4.5" fill="#fff" stroke={INK} strokeWidth="4" />
      <rect x="-5" y="-29" width="9" height="26" rx="4.5" fill="#fff" stroke={INK} strokeWidth="4" />
      <rect x="4" y="-25" width="9" height="22" rx="4.5" fill="#fff" stroke={INK} strokeWidth="4" />
      {/* palm + thumb */}
      <path d="M-15,-6 Q-16,12 0,13 Q16,12 15,-6 Z" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M13,2 Q26,-2 24,-12 Q20,-16 14,-8" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    </g>
  )
}

// A rubber-hose arm: ink outline, blue core, glove. Refs are filled in for per-frame posing.
function Arm({ pose, refs }) {
  const d = armD(pose)
  return (
    <>
      <path ref={refs.ink} d={d} fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" />
      <path ref={refs.core} d={d} fill="none" style={{ stroke: 'rgb(var(--tick-a-rgb))' }} strokeWidth="8" strokeLinecap="round" />
      <Glove pose={pose} ref={refs.glove} />
    </>
  )
}

// Time-of-day picker, opened by clicking Kairo: above its head; if that would run under the nav,
// beside the head on the left; failing that (narrow phones), just below the top of the head. Esc, a click elsewhere or scrolling
// closes it.
const NAV_H = 80
function ThemePicker({ at, onClose }) {
  const box = useRef(null)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const w = el.offsetWidth
    const h = el.offsetHeight
    const clampX = (x) => Math.min(Math.max(x, 12 + w / 2), innerWidth - 12 - w / 2)
    let left = clampX(at.x)
    let top = at.y - h
    if (top < NAV_H) {
      if (at.left - w - 16 >= 12) {
        left = at.left - 16 - w / 2
        top = Math.max(NAV_H, at.head - h / 2)
      } else top = at.y + 8
    }
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [at])
  useEffect(() => {
    box.current?.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true })
    const onKey = (e) => e.key === 'Escape' && onClose()
    const onDown = (e) => !box.current?.contains(e.target) && !e.target.closest?.('.mascot-hit') && onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('scroll', onClose, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onClose)
    }
  }, [onClose])
  return (
    <div ref={box} className="theme-picker" role="group" aria-label="Time of day colours" style={{ left: at.x, top: at.y }}>
      <span className="theme-picker-label mono">Time of day</span>
      <div className="theme-picker-row">
        {availableThemes().map((t) => (
          <button
            key={t.id}
            type="button"
            className="theme-swatch"
            aria-pressed={themeState.id === t.id}
            style={{ '--a': t.swatch?.[0] ?? `rgb(${t.tickA})`, '--b': t.swatch?.[1] ?? `rgb(${t.accent})` }}
            onClick={(e) => {
              const b = e.currentTarget.getBoundingClientRect()
              setTheme(t.id, { x: b.left + b.width / 2, y: b.top + b.height / 2 })
              onClose()
            }}
          >
            <span className="theme-swatch-dot" aria-hidden="true" />
            <span className="theme-swatch-name">{t.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Mascot({ visible }) {
  const reduce = useReducedMotion()
  const root = useRef(null)
  const [picker, setPicker] = useState(null) // where the theme picker is open ({ x, y }), or null
  const closePicker = useRef(() => setPicker(null)).current
  const armRefs = () => ({ ink: useRef(null), core: useRef(null), glove: useRef(null) })
  const r = {
    body: useRef(null),
    pupils: [useRef(null), useRef(null)],
    eyes: [useRef(null), useRef(null)],
    brows: [useRef(null), useRef(null)],
    cheeks: [useRef(null), useRef(null)],
    smile: useRef(null),
    hmm: useRef(null),
    open: useRef(null),
    arm: useRef(null),
    hammer: useRef(null),
    hour: useRef(null),
    minute: useRef(null),
    legs: [useRef(null), useRef(null)],
    rings: useRef(null),
    zzz: useRef(null),
    dots: useRef(null),
    q: useRef(null),
    steam: useRef(null),
    tint: useRef(null),
    leftBack: useRef(null),
    leftFront: useRef(null),
  }
  // The left arm is drawn twice: behind the body on the hip, in front of it at the chin.
  const left = [armRefs(), armRefs()]
  const right = armRefs()

  useEffect(() => {
    let raf = 0
    let pointer = null
    const look = { x: 0, y: 0 }
    let nextBlink = performance.now() + 2500
    let blinkStart = -1
    let talk = 0
    let think = 0
    let waveStart = visible ? performance.now() + 900 : -1
    let nextWave = performance.now() + 14000
    let ringStart = -1
    let lastInput = performance.now()
    let sleep = 0
    let lastScrollY = window.scrollY
    let glanceUntil = 0
    let wasTalking = false
    let nodStart = -1
    let spin = 0 // extra turns of the clock hands while thinking (degrees of the minute hand)
    const moodW = [0, 0, 0, 0] // smoothed weight of each mood level (0 calm … 3 grumpy)
    let hipR = 0 // right hand on the hip (annoyed / grumpy)
    let seenRelief = faceState.relief

    const wake = () => {
      // Waking up: a quick blink as the eyes open.
      if (sleep > 0.5) blinkStart = performance.now()
      lastInput = performance.now()
    }
    const onMove = (e) => {
      pointer = { x: e.clientX, y: e.clientY }
      wake()
    }
    const onLeave = () => (pointer = null)
    const onScroll = () => {
      if (window.scrollY > lastScrollY + 2) glanceUntil = performance.now() + 1200
      lastScrollY = window.scrollY
      wake()
    }
    const onRing = () => {
      wake()
      ringStart = performance.now()
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', wake)
    window.addEventListener('touchstart', wake, { passive: true })
    window.addEventListener('tick-ring', onRing)
    document.addEventListener('pointerleave', onLeave)

    const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed))
    const setArm = (refs, p) => {
      const d = armD(p)
      refs.ink.current?.setAttribute('d', d)
      refs.core.current?.setAttribute('d', d)
      refs.glove.current?.setAttribute('transform', gloveT(p))
    }
    let last = performance.now()

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      const svg = root.current
      if (!svg) return

      // Dozing: after SLEEP_MS without input (never while the chat is busy).
      const busy = faceState.thinking || faceState.talking || ringStart >= 0
      if (busy) lastInput = now
      // Slow to nod off, quick to wake.
      const drowsy = now - lastInput > SLEEP_MS
      sleep = smooth(sleep, drowsy ? 1 : 0, dt, drowsy ? 1.5 : 8)

      // Mood: cools down one level after a quiet spell; each level's weight eases in and out.
      if (faceState.mood > 0 && now - faceState.moodAt > COOL_MS) {
        faceState.mood -= 1
        faceState.moodAt = now
      }
      moodW.forEach((w, i) => (moodW[i] = smooth(w, faceState.mood === i ? 1 : 0, dt, 6)))
      const [, w1, w2, w3] = moodW
      hipR = smooth(hipR, faceState.mood >= 2 ? 1 : 0, dt, 5)

      think = smooth(think, faceState.thinking ? 1 : 0, dt, 8)

      // Eyes: look toward the cursor (in screen space), glance up while thinking, read along
      // while talking, and look down after the particles while the page scrolls.
      let tx = Math.sin(t * 0.5) * 0.4
      let ty = Math.sin(t * 0.37) * 0.2
      if (faceState.thinking) {
        tx = 0.5
        ty = -0.9
      } else if (faceState.talking) {
        tx = Math.sin(t * 2.6) * 0.7
        ty = 0.35
      } else if (now < glanceUntil) {
        tx = -0.25
        ty = 1
      } else if (sleep > 0.5) {
        tx = 0
        ty = 0.4
      } else if (pointer) {
        const box = svg.getBoundingClientRect()
        const cx = box.left + box.width * 0.5
        const cy = box.top + box.height * 0.38
        const dx = pointer.x - cx
        const dy = pointer.y - cy
        const len = Math.hypot(dx, dy) || 1
        const k = Math.min(1, len / 220)
        tx = (dx / len) * k
        ty = (dy / len) * k
      }
      look.x = smooth(look.x, tx, dt, 12)
      look.y = smooth(look.y, ty, dt, 12)

      // Blink (time-based).
      if (blinkStart < 0 && now > nextBlink) blinkStart = now
      let lid = 1
      if (blinkStart >= 0) {
        const k = (now - blinkStart) / 160
        if (k >= 1) {
          blinkStart = -1
          nextBlink = now + (Math.random() < 0.2 ? 120 : 2500 + Math.random() * 3500)
        } else lid = 1 - Math.sin(k * Math.PI) * 0.92
      }
      // Dozing closes the eyes; a grumpy glare narrows them.
      lid = Math.min(lid, 1 - sleep * 0.92, 1 - w3 * 0.3)
      EYES.forEach((e, i) => {
        r.eyes[i].current?.setAttribute('transform', `translate(${e.x} ${e.y}) scale(1 ${lid}) translate(${-e.x} ${-e.y})`)
        r.pupils[i].current?.setAttribute('transform', `translate(${look.x * 8} ${look.y * 11})`)
      })

      // Brows (left, right): [lift, tilt]. Thinking raises one; confused tilts; annoyed and
      // grumpy pull them down into a V.
      const browL = [-3 * think + 2 * w1 + 3 * w2 + 6 * w3, 8 * w1 + 12 * w2 + 24 * w3]
      const browR = [-11 * think - 9 * w1 + 3 * w2 + 6 * w3, -6 * think - 4 * w1 - 12 * w2 - 24 * w3]
      r.brows[0].current?.setAttribute('transform', `translate(0 ${browL[0]}) rotate(${browL[1]} 128 116)`)
      r.brows[1].current?.setAttribute('transform', `translate(0 ${browR[0]}) rotate(${browR[1]} 192 116)`)

      // Cheeks flush and an angry red glow spreads over the dial when grumpy.
      r.cheeks.forEach((c) => {
        c.current?.setAttribute('opacity', (0.45 + 0.45 * w3).toFixed(2))
        c.current?.setAttribute('rx', (11 + 4 * w3).toFixed(1))
      })
      r.tint.current?.setAttribute('opacity', (0.2 * w3 * (0.85 + 0.15 * Math.sin(t * 6))).toFixed(3))

      // Mouth: the smile flattens into a frown as the mood sours; "hmm" squiggle while thinking;
      // the open mouth while talking.
      talk = faceState.talking ? Math.max(0.15, 0.55 + 0.45 * Math.sin(t * 15) * Math.sin(t * 4.7)) : smooth(talk, 0, dt, 12)
      const open = talk > 0.05
      r.open.current?.setAttribute('transform', `translate(160 203) scale(1 ${talk}) translate(-160 -203)`)
      r.open.current?.setAttribute('opacity', open ? 1 : 0)
      const cy = 226 - 12 * w1 - 32 * w2 - 40 * w3
      r.smile.current?.setAttribute('d', `M134,${203 + 3 * (w2 + w3)} Q160,${cy} 186,${203 + 3 * (w2 + w3)}`)
      r.smile.current?.setAttribute('opacity', open ? 0 : (1 - think).toFixed(2))
      r.hmm.current?.setAttribute('opacity', open ? 0 : think.toFixed(2))

      // Thought dots pulse above the head while thinking; "?" pops up when confused.
      if (r.dots.current) {
        r.dots.current.setAttribute('opacity', think.toFixed(2))
        ;[...r.dots.current.children].forEach((c, i) => {
          const pulse = reduce ? 1 : Math.max(0, Math.sin(t * 4 - i * 0.9))
          c.setAttribute('opacity', (0.35 + 0.65 * pulse).toFixed(2))
        })
      }
      r.q.current?.setAttribute('opacity', w1.toFixed(2))
      r.q.current?.setAttribute('transform', `translate(254 70) scale(${(w1 * (1 + (reduce ? 0 : 0.08 * Math.sin(t * 4)))).toFixed(3)})`)

      // Steam puffs from the bells when grumpy.
      if (r.steam.current) {
        r.steam.current.setAttribute('opacity', w3.toFixed(2))
        ;[...r.steam.current.children].forEach((c, i) => {
          const side = i < 3 ? -1 : 1
          const k = reduce ? 0.4 : (t * 0.9 + (i % 3) / 3) % 1
          c.setAttribute('cx', (160 + side * 74 + side * k * 26).toFixed(1))
          c.setAttribute('cy', (62 - k * 44).toFixed(1))
          c.setAttribute('r', (4 + k * 8).toFixed(1))
          c.setAttribute('opacity', (Math.sin(k * Math.PI) * 0.8).toFixed(2))
        })
      }

      // A nod once an answer has been typed out.
      if (wasTalking && !faceState.talking && !reduce) nodStart = now
      wasTalking = faceState.talking
      let nod = 0
      if (nodStart >= 0) {
        const k = (now - nodStart) / 700
        if (k >= 1) nodStart = -1
        else nod = Math.sin(k * Math.PI * 2) ** 2 * (1 - k) * 7
      }

      // Relief after a bad mood: a happy hop and a wave.
      let hop = 0
      if (faceState.relief !== seenRelief) {
        seenRelief = faceState.relief
        waveStart = now
      }
      const rk = (now - faceState.relief) / 600
      if (faceState.relief && rk >= 0 && rk < 1 && !reduce) hop = -Math.sin(rk * Math.PI) * 16

      // Ringing: the hammer rattles between the bells, the body shakes, ring marks flash.
      // Grumpy Kairo rattles its alarm in short angry bursts.
      let ring = 0
      if (ringStart >= 0) {
        const k = (now - ringStart) / RING_MS
        if (k >= 1) ringStart = -1
        else ring = reduce ? 0 : 1 - k * k
      }
      const phase = t % 3
      const burst = reduce || phase > 0.35 ? 0 : Math.sin((phase / 0.35) * Math.PI) * 0.7 * w3
      const shakeK = Math.max(ring, burst)
      r.rings.current?.setAttribute('opacity', (ring > 0 ? (0.5 + 0.5 * Math.sin(t * 50)) * ring : 0).toFixed(2))

      // Waving: on arrival, every so often, and a little while talking (not while dozing or
      // with hands on hips).
      if (sleep > 0.1 || faceState.mood >= 2) nextWave = now + 4000
      if (visible && waveStart < 0 && now > nextWave) {
        waveStart = now
        nextWave = now + 14000 + Math.random() * 6000
      }
      let wave = 0
      if (waveStart >= 0 && now >= waveStart) {
        const k = (now - waveStart) / 2200
        if (k >= 1) waveStart = -1
        else wave = Math.sin(k * Math.PI)
      }
      const armAngle = (wave * Math.sin(t * 11) * 22 + (faceState.talking ? Math.sin(t * 5) * 6 : 0)) * (1 - hipR)
      r.arm.current?.setAttribute('transform', `rotate(${armAngle} 256 168)`)

      // Arms: right hand to the hip when annoyed; left hand up to the chin while thinking.
      setArm(right, lerpPose(POSE.rightWave, POSE.rightHip, hipR))
      const chin = lerpPose(POSE.leftHip, POSE.leftChin, think)
      setArm(left[0], chin)
      setArm(left[1], chin)
      r.leftBack.current?.setAttribute('opacity', think < 0.5 ? 1 : 0)
      r.leftFront.current?.setAttribute('opacity', think < 0.5 ? 0 : 1)

      // Idle bounce: the body bobs (slow breathing while dozing) and the legs stretch to stay
      // planted. Head tilts: sideways when confused, a little back while thinking.
      const bob = reduce ? 0 : Math.sin(t * (2.2 - sleep * 1.4)) * 3 + nod + hop
      const shake = Math.sin(t * 70) * 3 * shakeK
      const tilt = Math.sin(t * 45) * 2.5 * shakeK + 7 * w1 - 4 * think
      r.body.current?.setAttribute('transform', `translate(${shake} ${bob}) rotate(${tilt} 160 175)`)
      r.legs.forEach((leg, i) => {
        leg.current?.setAttribute('x1', (i ? 182 : 138) + shake)
        leg.current?.setAttribute('y1', 268 + bob)
      })
      const rattle = shakeK > 0 ? Math.sin(t * 60) * 20 * shakeK : wave > 0.2 ? Math.sin(t * 40) * 10 : 0
      r.hammer.current?.setAttribute('transform', `rotate(${rattle} 160 70)`)

      // Floating "z"s while dozing.
      if (r.zzz.current) {
        r.zzz.current.setAttribute('opacity', sleep.toFixed(2))
        ;[...r.zzz.current.children].forEach((z, i) => {
          const k = reduce ? 0.3 + i * 0.25 : (t * 0.45 + i / 3) % 1
          z.setAttribute('transform', `translate(${232 + k * 26 + i * 4} ${84 - k * 60}) scale(${0.6 + k * 0.7})`)
          z.setAttribute('opacity', Math.sin(k * Math.PI).toFixed(2))
        })
      }

      // Real local time on the dial. While thinking the hands spin ("processing"), then run on
      // to the next full turn so they settle back on the real time.
      if (faceState.thinking && !reduce) spin += dt * 540 * think
      else if (spin) {
        const target = Math.ceil(spin / 360 - 0.001) * 360
        spin = smooth(spin, target, dt, 6)
        if (Math.abs(target - spin) < 0.5) spin = 0
      }
      const d = new Date()
      const min = d.getMinutes() + d.getSeconds() / 60
      const hr = (d.getHours() % 12) + min / 60
      r.minute.current?.setAttribute('transform', `rotate(${min * 6 + spin} ${C.x} ${C.y})`)
      r.hour.current?.setAttribute('transform', `rotate(${hr * 30 + spin / 12} ${C.x} ${C.y})`)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', wake)
      window.removeEventListener('touchstart', wake)
      window.removeEventListener('tick-ring', onRing)
      document.removeEventListener('pointerleave', onLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, reduce])

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2
    const big = i % 3 === 0
    const r1 = big ? 70 : 75
    return (
      <line
        key={i}
        x1={C.x + Math.sin(a) * r1}
        y1={C.y - Math.cos(a) * r1}
        x2={C.x + Math.sin(a) * 82}
        y2={C.y - Math.cos(a) * 82}
        stroke={INK}
        strokeWidth={big ? 5 : 3}
        strokeLinecap="round"
      />
    )
  })

  return (
    <>
    <div className={`mascot${visible ? ' is-visible' : ''}`} aria-hidden="true">
      <svg ref={root} viewBox="0 0 320 400" className="mascot-svg">
        <defs>
          <linearGradient id="tick-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'rgb(var(--tick-a-rgb))' }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--tick-b-rgb))' }} />
          </linearGradient>
          <radialGradient id="tick-dial" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#f3e6cc" />
          </radialGradient>
          <radialGradient id="tick-floor">
            <stop offset="0" style={{ stopColor: 'rgb(var(--tick-a-rgb))' }} stopOpacity="0.55" />
            <stop offset="0.6" style={{ stopColor: 'rgb(var(--tick-b-rgb))' }} stopOpacity="0.18" />
            <stop offset="1" style={{ stopColor: 'rgb(var(--tick-b-rgb))' }} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="tick-angry">
            <stop offset="0" stopColor="#ef4444" stopOpacity="0.3" />
            <stop offset="1" stopColor="#ef4444" stopOpacity="1" />
          </radialGradient>
          <pattern id="tick-scan" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1.4" fill="#ffffff" opacity="0.18" />
          </pattern>
          <clipPath id="tick-clip">
            <circle cx={C.x} cy={C.y} r="105" />
          </clipPath>
        </defs>

        {/* Light pool where Kairo stands on the chat box */}
        <ellipse cx="160" cy="366" rx="86" ry="11" fill="url(#tick-floor)" />
        {/* Legs + shoes (outside the bobbing body so the feet stay planted) */}
        <line ref={r.legs[0]} x1="138" y1="268" x2="132" y2="348" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <line ref={r.legs[1]} x1="182" y1="268" x2="188" y2="348" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M108,360 Q108,342 130,343 Q148,344 148,360 Z" style={{ fill: 'rgb(var(--shoe-rgb))' }} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M172,360 Q172,344 190,343 Q212,342 212,360 Z" style={{ fill: 'rgb(var(--shoe-rgb))' }} stroke={INK} strokeWidth="4" strokeLinejoin="round" />

        <g ref={r.body}>
          {/* Steam puffs from the bells (grumpy) */}
          <g ref={r.steam} opacity="0" fill="#e2e8f0">
            {Array.from({ length: 6 }, (_, i) => (
              <circle key={i} r="4" />
            ))}
          </g>
          {/* Bells + hammer */}
          <g transform="rotate(-28 96 82)">
            <path d="M64,96 A32,32 0 0 1 128,96 Z" fill="url(#tick-body)" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
            <circle cx="96" cy="60" r="5" fill={INK} />
          </g>
          <g transform="rotate(28 224 82)">
            <path d="M192,96 A32,32 0 0 1 256,96 Z" fill="url(#tick-body)" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
            <circle cx="224" cy="60" r="5" fill={INK} />
          </g>
          <g ref={r.hammer}>
            <line x1="160" y1="70" x2="160" y2="46" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <circle cx="160" cy="42" r="7" style={{ fill: 'rgb(var(--shoe-rgb))' }} stroke={INK} strokeWidth="4" />
          </g>
          {/* Ring marks beside the bells (shown while the alarm rings) */}
          <g ref={r.rings} opacity="0" style={{ stroke: 'rgb(var(--shoe-rgb))' }} strokeWidth="4" strokeLinecap="round">
            <path d="M52,70 L38,62 M50,86 L34,86 M58,54 L48,42" />
            <path d="M268,70 L282,62 M270,86 L286,86 M262,54 L272,42" />
          </g>

          {/* Left arm, behind the body: hand on hip */}
          <g ref={r.leftBack}>
            <Arm pose={POSE.leftHip} refs={left[0]} />
          </g>

          {/* Body + dial */}
          <circle cx={C.x} cy={C.y} r="105" fill="url(#tick-body)" stroke={INK} strokeWidth="6" />
          <circle cx={C.x} cy={C.y} r="88" fill="url(#tick-dial)" stroke={INK} strokeWidth="4" />
          {/* Angry red glow over the dial (grumpy) */}
          <circle ref={r.tint} cx={C.x} cy={C.y} r="86" fill="url(#tick-angry)" opacity="0" />
          {ticks}
          {/* Clock hands show the real time; the centre pin doubles as the nose */}
          <line ref={r.hour} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 40} style={{ stroke: 'rgb(var(--tick-b-rgb))' }} strokeWidth="6" strokeLinecap="round" opacity="0.55" />
          <line ref={r.minute} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 62} style={{ stroke: 'rgb(var(--tick-b-rgb))' }} strokeWidth="4" strokeLinecap="round" opacity="0.55" />

          {/* Cheeks */}
          <ellipse ref={r.cheeks[0]} cx="104" cy="196" rx="11" ry="6" fill="#fb7185" opacity="0.45" />
          <ellipse ref={r.cheeks[1]} cx="216" cy="196" rx="11" ry="6" fill="#fb7185" opacity="0.45" />

          {/* Brows */}
          <path ref={r.brows[0]} d="M110,121 Q128,111 146,121" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path ref={r.brows[1]} d="M174,121 Q192,111 210,121" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />

          {/* Eyes */}
          {EYES.map((e, i) => (
            <g key={i} ref={r.eyes[i]}>
              <ellipse cx={e.x} cy={e.y} rx="21" ry="27" fill="#fff" stroke={INK} strokeWidth="4.5" />
              <g ref={r.pupils[i]}>
                <ellipse cx={e.x} cy={e.y + 3} rx="10" ry="13" fill={INK} />
                <circle cx={e.x - 3} cy={e.y - 3} r="3.5" fill="#fff" />
              </g>
            </g>
          ))}
          <circle cx={C.x} cy={C.y} r="6" fill={INK} />

          {/* Mouth: smile (turns into a frown with the mood), "hmm" squiggle, open "talking" mouth */}
          <path ref={r.smile} d="M134,203 Q160,226 186,203" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <path ref={r.hmm} d="M138,212 Q149,203 160,211 Q171,219 182,209" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" opacity="0" />
          <g ref={r.open} opacity="0">
            <path d="M134,203 Q160,246 186,203 Z" fill="#4a0d16" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
            <ellipse cx="160" cy="221" rx="11" ry="6" fill="#fb7185" />
          </g>

          {/* Hologram scanlines over the body */}
          <rect x="40" y="60" width="240" height="240" fill="url(#tick-scan)" clipPath="url(#tick-clip)" />

          {/* Left arm, in front of the body: hand on chin (thinking) */}
          <g ref={r.leftFront} opacity="0">
            <Arm pose={POSE.leftHip} refs={left[1]} />
          </g>

          {/* Right arm: waving, or hand on hip */}
          <g ref={r.arm}>
            <Arm pose={POSE.rightWave} refs={right} />
          </g>

          {/* Thought dots (thinking) and a "?" (confused) */}
          <g ref={r.dots} opacity="0" style={{ fill: 'rgb(var(--glass-pale-rgb))' }}>
            <circle cx="206" cy="40" r="5" />
            <circle cx="224" cy="25" r="6.5" />
            <circle cx="246" cy="13" r="8" />
          </g>
          <g ref={r.q} opacity="0">
            <text textAnchor="middle" y="14" style={{ fill: 'var(--amber)' }} fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="44">
              ?
            </text>
          </g>

          {/* Click target: ring the alarm and open the time-of-day picker */}
          <circle
            className="mascot-hit"
            role="button"
            data-cursor="alarm"
            cx={C.x}
            cy={C.y - 20}
            r="125"
            fill="transparent"
            onClick={(e) => {
              window.dispatchEvent(new Event('tick-ring'))
              const b = e.currentTarget.getBoundingClientRect()
              setPicker((p) => (p ? null : { x: b.left + b.width / 2, y: b.top + 4, left: b.left, head: b.top + b.height * 0.35 }))
            }}
          />
        </g>

        {/* "z"s that float up while Kairo dozes */}
        <g ref={r.zzz} opacity="0" style={{ fill: 'rgb(var(--glass-pale-rgb))' }} fontFamily="system-ui, sans-serif" fontWeight="800" fontSize="22">
          <text>z</text>
          <text>z</text>
          <text>z</text>
        </g>
      </svg>
    </div>
    {picker && visible && createPortal(<ThemePicker at={picker} onClose={closePicker} />, document.body)}
    </>
  )
}
