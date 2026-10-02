import { useEffect, useRef } from 'react'
import { faceState } from '../chat/faceState.js'
import { useReducedMotion } from '../hooks.js'

// "Tick" — an original rubber-hose alarm-clock character drawn in SVG.
// Eyes follow the cursor, it blinks, waves, talks with the chat, and its
// clock hands show the visitor's real local time.

const C = { x: 160, y: 175 } // dial centre
const EYES = [
  { x: 128, y: 158 },
  { x: 192, y: 158 },
]
const INK = '#0b1324'

function Glove({ x, y, rot = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
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

export default function Mascot({ visible }) {
  const reduce = useReducedMotion()
  const root = useRef(null)
  const r = {
    body: useRef(null),
    pupils: [useRef(null), useRef(null)],
    eyes: [useRef(null), useRef(null)],
    brows: useRef(null),
    smile: useRef(null),
    open: useRef(null),
    arm: useRef(null),
    hammer: useRef(null),
    hour: useRef(null),
    minute: useRef(null),
    legs: [useRef(null), useRef(null)],
  }

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

    const onMove = (e) => (pointer = { x: e.clientX, y: e.clientY })
    const onLeave = () => (pointer = null)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)

    const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed))
    let last = performance.now()

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const t = now / 1000
      const svg = root.current
      if (!svg) return

      // Eyes: look toward the cursor (in screen space), glance up while thinking.
      let tx = Math.sin(t * 0.5) * 0.4
      let ty = Math.sin(t * 0.37) * 0.2
      if (faceState.thinking) {
        tx = 0.5
        ty = -0.9
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
      EYES.forEach((e, i) => {
        r.eyes[i].current?.setAttribute('transform', `translate(${e.x} ${e.y}) scale(1 ${lid}) translate(${-e.x} ${-e.y})`)
        r.pupils[i].current?.setAttribute('transform', `translate(${look.x * 8} ${look.y * 11})`)
      })

      think = smooth(think, faceState.thinking ? 1 : 0, dt, 8)
      r.brows.current?.setAttribute('transform', `translate(0 ${-think * 6})`)

      // Talking: the open mouth grows and shrinks; the smile hides while it's open.
      talk = faceState.talking ? Math.max(0.15, 0.55 + 0.45 * Math.sin(t * 15) * Math.sin(t * 4.7)) : smooth(talk, 0, dt, 12)
      r.open.current?.setAttribute('transform', `translate(160 203) scale(1 ${talk}) translate(-160 -203)`)
      r.open.current?.setAttribute('opacity', talk > 0.05 ? 1 : 0)
      r.smile.current?.setAttribute('opacity', talk > 0.05 ? 0 : 1)

      // Waving: on arrival, every so often, and a little while talking.
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
      const armAngle = wave * Math.sin(t * 11) * 22 + (faceState.talking ? Math.sin(t * 5) * 6 : 0)
      r.arm.current?.setAttribute('transform', `rotate(${armAngle} 256 168)`)

      // Idle bounce: the body bobs and the legs stretch to stay planted.
      const bob = reduce ? 0 : Math.sin(t * 2.2) * 3
      r.body.current?.setAttribute('transform', `translate(0 ${bob})`)
      r.legs[0].current?.setAttribute('y1', 268 + bob)
      r.legs[1].current?.setAttribute('y1', 268 + bob)
      r.hammer.current?.setAttribute('transform', `rotate(${(wave > 0.2 ? Math.sin(t * 40) * 10 : 0)} 160 70)`)

      // Real local time on the dial.
      const d = new Date()
      const min = d.getMinutes() + d.getSeconds() / 60
      const hr = (d.getHours() % 12) + min / 60
      r.minute.current?.setAttribute('transform', `rotate(${min * 6} ${C.x} ${C.y})`)
      r.hour.current?.setAttribute('transform', `rotate(${hr * 30} ${C.x} ${C.y})`)

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
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
    <div className={`mascot${visible ? ' is-visible' : ''}`} aria-hidden="true">
      <svg ref={root} viewBox="0 0 320 400" className="mascot-svg">
        <defs>
          <linearGradient id="tick-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#38bdf8" />
            <stop offset="1" stopColor="#1d4ed8" />
          </linearGradient>
          <radialGradient id="tick-dial" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#f3e6cc" />
          </radialGradient>
          <radialGradient id="tick-floor">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#1d4ed8" stopOpacity="0.18" />
            <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>
          <pattern id="tick-scan" width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="1.4" fill="#ffffff" opacity="0.18" />
          </pattern>
          <clipPath id="tick-clip">
            <circle cx={C.x} cy={C.y} r="105" />
          </clipPath>
        </defs>

        {/* Light pool where Tick stands on the chat box */}
        <ellipse cx="160" cy="366" rx="86" ry="11" fill="url(#tick-floor)" />
        {/* Legs + shoes (outside the bobbing body so the feet stay planted) */}
        <line ref={r.legs[0]} x1="138" y1="268" x2="132" y2="348" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <line ref={r.legs[1]} x1="182" y1="268" x2="188" y2="348" stroke={INK} strokeWidth="7" strokeLinecap="round" />
        <path d="M108,360 Q108,342 130,343 Q148,344 148,360 Z" fill="#f59e0b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M172,360 Q172,344 190,343 Q212,342 212,360 Z" fill="#f59e0b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />

        <g ref={r.body}>
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
            <circle cx="160" cy="42" r="7" fill="#f59e0b" stroke={INK} strokeWidth="4" />
          </g>

          {/* Left arm: hand on hip */}
          <path d="M66,200 C30,206 26,238 50,256" fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" />
          <path d="M66,200 C30,206 26,238 50,256" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
          <Glove x={56} y={258} rot={-130} />

          {/* Body + dial */}
          <circle cx={C.x} cy={C.y} r="105" fill="url(#tick-body)" stroke={INK} strokeWidth="6" />
          <circle cx={C.x} cy={C.y} r="88" fill="url(#tick-dial)" stroke={INK} strokeWidth="4" />
          {ticks}
          {/* Clock hands show the real time; the centre pin doubles as the nose */}
          <line ref={r.hour} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 40} stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" opacity="0.55" />
          <line ref={r.minute} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 62} stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" opacity="0.55" />

          {/* Cheeks */}
          <ellipse cx="104" cy="196" rx="11" ry="6" fill="#fb7185" opacity="0.45" />
          <ellipse cx="216" cy="196" rx="11" ry="6" fill="#fb7185" opacity="0.45" />

          {/* Brows */}
          <g ref={r.brows}>
            <path d="M110,121 Q128,111 146,121" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <path d="M174,121 Q192,111 210,121" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          </g>

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

          {/* Mouth: smile, and an open "talking" mouth */}
          <path ref={r.smile} d="M134,203 Q160,226 186,203" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          <g ref={r.open} opacity="0">
            <path d="M134,203 Q160,246 186,203 Z" fill="#4a0d16" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
            <ellipse cx="160" cy="221" rx="11" ry="6" fill="#fb7185" />
          </g>

          {/* Hologram scanlines over the body */}
          <rect x="40" y="60" width="240" height="240" fill="url(#tick-scan)" clipPath="url(#tick-clip)" />

          {/* Right arm: waving */}
          <g ref={r.arm}>
            <path d="M256,168 C290,158 300,128 292,98" fill="none" stroke={INK} strokeWidth="15" strokeLinecap="round" />
            <path d="M256,168 C290,158 300,128 292,98" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" />
            <Glove x={292} y={86} rot={8} />
          </g>
        </g>
      </svg>
    </div>
  )
}
