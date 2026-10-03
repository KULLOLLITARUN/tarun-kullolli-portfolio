import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks.js'

// A mini "Kairo" (the hero mascot) that walks along the career timeline as you scroll.
// It pauses at each act, and its clock hands run behind and catch up to the real time
// as it reaches the last ("NOW") act, where it waves. Lives next to the timeline <ol>.

const INK = '#0b1324'
const C = { x: 50, y: 58 } // dial centre (viewBox units)
const VB = { w: 100, h: 130 }
const FOOT = 124 // y of the shoe soles in the viewBox
const STRIDE = 7 // px walked per leg-swing radian
const WALK = 110 // walking speed cap (px per second)
const IGNITE = 0.25 // s between the line's ignite flash and Kairo popping out
const POP = 0.6 // s to rise out of the line
const SINK = 0.35 // s to sink back in
// Ease-out with a little overshoot (the "pop").
const backOut = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2
const smooth = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-dt * speed))
const clamp01 = (v) => Math.min(1, Math.max(0, v))

function Leg({ legRef, hipX, footX }) {
  return (
    <g ref={legRef}>
      <line x1={hipX} y1="90" x2={footX} y2="116" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path
        d={`M${footX - 10},${FOOT} Q${footX - 10},${FOOT - 9} ${footX},${FOOT - 9} Q${footX + 9},${FOOT - 9} ${footX + 9},${FOOT} Z`}
        style={{ fill: 'rgb(var(--shoe-rgb))' }}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  )
}

export default function TimelineTick() {
  const reduce = useReducedMotion()
  const host = useRef(null)
  const burst = useRef(null)
  const r = {
    body: useRef(null),
    legs: [useRef(null), useRef(null)],
    arm: useRef(null),
    hour: useRef(null),
    minute: useRef(null),
    pupils: useRef(null),
  }

  useEffect(() => {
    const el = host.current
    const wrap = el?.parentElement
    const list = wrap?.querySelector('.acts')
    if (!el || !list) return
    let raf = 0
    let last = 0
    let pos = null // px along the line
    let lastPos = 0
    let phase = 0
    let swing = 0
    let facing = 1
    let idle = 0
    // Pop sequence: hidden → popping (rises out of the line) → shown → sinking → hidden.
    let state = 'hidden'
    let popT = 0
    let burstPending = false
    // Hovering an act sends Kairo walking to that act's node (mouse only).
    let hover = null
    const onOver = (e) => {
      if (e.pointerType !== 'mouse') return
      const act = e.target.closest?.('.act')
      hover = act && act.parentElement === list ? [...list.children].indexOf(act) : null
    }
    const onOut = (e) => {
      if (!list.contains(e.relatedTarget)) hover = null
    }
    list.addEventListener('pointerover', onOver)
    list.addEventListener('pointerout', onOut)

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000 || 0, 0.05)
      last = now
      const acts = [...list.children]
      if (!acts.length) return
      const vertical = acts.length > 1 && Math.abs(acts[1].offsetLeft - acts[0].offsetLeft) < 2
      // Node positions along the line, matching .act::before (9px dots).
      const nodes = acts.map((a) => (vertical ? a.offsetTop + 8.5 : a.offsetLeft + 4.5))
      const rect = list.getBoundingClientRect()
      const vh = window.innerHeight
      // Walk progress follows the reading position through the section.
      let p = vertical ? (vh * 0.6 - rect.top) / Math.max(1, rect.height * 0.75) : (vh * 0.8 - rect.top) / (vh * 0.55)
      p = reduce ? 1 : clamp01(p)
      // Between nodes the walk eases in and out, so Kairo pauses at every act.
      const segs = nodes.length - 1
      let target = nodes[0]
      if (segs > 0) {
        const sp = p * segs
        const k = Math.min(segs - 1, Math.floor(sp))
        const t = p >= 1 ? 1 : sp - k
        target = nodes[k] + (nodes[k + 1] - nodes[k]) * (t * t * (3 - 2 * t))
      }
      if (hover !== null && !reduce && nodes[hover] !== undefined) target = nodes[hover]

      // Pop sequence, driven by how far the particles have drawn the line (--tl on the list;
      // unset = no particle effect, so Kairo is simply there). Hysteresis (0.98 / 0.5) stops it
      // replaying when the scroll wobbles around the line.
      const tlStr = list.style.getPropertyValue('--tl')
      if (tlStr === '' || reduce) state = 'shown'
      else {
        const tlv = Number.parseFloat(tlStr)
        if ((state === 'hidden' || state === 'sinking') && tlv >= 0.98) {
          if (state === 'hidden') {
            popT = -IGNITE
            burstPending = true
            // Restart the line's one-off ignite flash.
            list.classList.remove('is-lit')
            void list.offsetWidth
            list.classList.add('is-lit')
          }
          state = 'popping'
        } else if ((state === 'shown' || state === 'popping') && tlv < 0.5) {
          state = 'sinking'
          list.classList.remove('is-lit')
        }
      }
      if (state === 'popping') {
        popT += dt
        if (burstPending && popT >= 0) {
          burstPending = false
          const b = burst.current
          if (b) {
            b.style.translate = vertical ? `0.5px ${pos ?? target}px` : `${pos ?? target}px 0px`
            b.classList.remove('go')
            void b.offsetWidth
            b.classList.add('go')
          }
        }
        if (popT >= POP) {
          popT = POP
          state = 'shown'
        }
      } else if (state === 'sinking') {
        popT = Math.min(popT, POP) - dt * (POP / SINK)
        if (popT <= 0) {
          popT = 0
          state = 'hidden'
        }
      }

      // While hidden, Kairo waits where it will pop up; once out, it walks.
      if (pos === null || reduce || state === 'hidden') pos = target
      else {
        // Walk at a steady pace (capped speed), easing in as Kairo nears its spot.
        const v = Math.max(-WALK, Math.min(WALK, (target - pos) * 3))
        pos += v * dt
      }
      const dx = pos - lastPos
      lastPos = pos
      const moving = Math.abs(dx) > 0.04
      if (!vertical && dx > 0.04) facing = 1
      else if (!vertical && dx < -0.04) facing = -1
      phase += Math.abs(dx) / STRIDE
      swing = moving ? Math.sin(phase) * 26 : smooth(swing, 0, dt, 10)
      const bob = moving ? -Math.abs(Math.sin(phase)) * 3 : 0

      // Place the soles on the line (desktop) or on the vertical line at the node (phones).
      const w = el.offsetWidth
      const h = (w * VB.h) / VB.w
      const sole = (FOOT / VB.h) * h
      // Rising out of the line: shifted down by the part still "inside" it, and clipped at the line.
      let rise = 1
      if (state === 'hidden') rise = 0
      else if (state === 'popping') rise = backOut(clamp01(popT / POP))
      else if (state === 'sinking') rise = clamp01(popT / POP) ** 2
      const drop = (1 - rise) * h
      const x = vertical ? -w / 2 + 0.5 : pos - w / 2
      const y = (vertical ? pos - sole : -sole + 0.5) + drop
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scaleX(${facing})`
      el.style.clipPath = rise >= 1 ? 'none' : `inset(0 0 ${Math.max(0, Math.min(h, drop + h - sole)).toFixed(1)}px 0)`
      el.style.opacity = state === 'hidden' || (state === 'popping' && popT < 0) ? '0' : '1'

      r.legs[0].current?.setAttribute('transform', `rotate(${swing} 43 90)`)
      r.legs[1].current?.setAttribute('transform', `rotate(${-swing} 57 90)`)
      r.body.current?.setAttribute('transform', `translate(0 ${bob})`)
      r.pupils.current?.setAttribute('transform', `translate(${moving ? 2.5 : 0} 0)`)

      // Clock hands: behind by up to ~10 hours at the start, the real time at the last act.
      const end = nodes[nodes.length - 1]
      const lag = segs > 0 ? ((end - pos) / Math.max(1, end - nodes[0])) * 600 : 0
      const d = new Date()
      const min = d.getMinutes() + d.getSeconds() / 60 - lag
      const hr = (d.getHours() % 12) + min / 60
      r.minute.current?.setAttribute('transform', `rotate(${min * 6} ${C.x} ${C.y})`)
      r.hour.current?.setAttribute('transform', `rotate(${hr * 30} ${C.x} ${C.y})`)

      // Wave now and then while standing at the last act, or at the act being hovered.
      idle = !moving && (p >= 1 || hover !== null) && !reduce ? idle + dt : 0
      const k = idle % 5
      const wave = idle > 0.6 && k < 1.6 ? Math.sin((k / 1.6) * Math.PI) : 0
      r.arm.current?.setAttribute('transform', `rotate(${-wave * (30 + Math.sin(now / 90) * 18)} 80 60)`)

      raf = requestAnimationFrame(frame)
    }

    // Start right away (so Kairo is placed even if the observer is slow), then only keep
    // animating while the timeline is near the viewport.
    last = performance.now()
    raf = requestAnimationFrame(frame)
    const io = new IntersectionObserver(
      ([entry]) => {
        cancelAnimationFrame(raf)
        if (entry.isIntersecting) {
          last = performance.now()
          raf = requestAnimationFrame(frame)
        }
      },
      { rootMargin: '200px 0px' },
    )
    io.observe(wrap)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      list.removeEventListener('pointerover', onOver)
      list.removeEventListener('pointerout', onOut)
      list.classList.remove('is-lit')
    }
  }, [reduce])

  const ticks = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2
    return (
      <line
        key={i}
        x1={C.x + Math.sin(a) * 22}
        y1={C.y - Math.cos(a) * 22}
        x2={C.x + Math.sin(a) * 26}
        y2={C.y - Math.cos(a) * 26}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    )
  })

  return (
    <>
    <span ref={burst} className="tl-burst" aria-hidden="true" />
    <div ref={host} className="tl-tick" aria-hidden="true">
      <svg viewBox={`0 0 ${VB.w} ${VB.h}`}>
        <defs>
          <linearGradient id="mtick-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'rgb(var(--tick-a-rgb))' }} />
            <stop offset="1" style={{ stopColor: 'rgb(var(--tick-b-rgb))' }} />
          </linearGradient>
          <radialGradient id="mtick-dial" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#fffaf0" />
            <stop offset="1" stopColor="#f3e6cc" />
          </radialGradient>
        </defs>
        <Leg legRef={r.legs[0]} hipX={43} footX={41} />
        <Leg legRef={r.legs[1]} hipX={57} footX={59} />
        <g ref={r.body}>
          {/* bells + hammer */}
          <path d="M14,26 A12,12 0 0 1 38,22 Z" fill="url(#mtick-body)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <path d="M62,22 A12,12 0 0 1 86,26 Z" fill="url(#mtick-body)" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="50" y1="24" x2="50" y2="14" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="50" cy="12" r="3.5" style={{ fill: 'rgb(var(--shoe-rgb))' }} stroke={INK} strokeWidth="2" />
          {/* left arm on the hip */}
          <path d="M18,66 C6,70 6,82 14,88" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
          <path d="M18,66 C6,70 6,82 14,88" fill="none" style={{ stroke: 'rgb(var(--tick-a-rgb))' }} strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="15" cy="89" r="5" fill="#fff" stroke={INK} strokeWidth="2.5" />
          {/* body + dial */}
          <circle cx={C.x} cy={C.y} r="34" fill="url(#mtick-body)" stroke={INK} strokeWidth="3" />
          <circle cx={C.x} cy={C.y} r="28" fill="url(#mtick-dial)" stroke={INK} strokeWidth="2" />
          {ticks}
          <line ref={r.hour} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 13} style={{ stroke: 'rgb(var(--tick-b-rgb))' }} strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <line ref={r.minute} x1={C.x} y1={C.y} x2={C.x} y2={C.y - 20} style={{ stroke: 'rgb(var(--tick-b-rgb))' }} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          {/* face */}
          <ellipse cx="34" cy="66" rx="4" ry="2.4" fill="#fb7185" opacity="0.5" />
          <ellipse cx="66" cy="66" rx="4" ry="2.4" fill="#fb7185" opacity="0.5" />
          <ellipse cx="41" cy="51" rx="6.5" ry="8.5" fill="#fff" stroke={INK} strokeWidth="2" />
          <ellipse cx="59" cy="51" rx="6.5" ry="8.5" fill="#fff" stroke={INK} strokeWidth="2" />
          <g ref={r.pupils}>
            <ellipse cx="41" cy="52" rx="3.2" ry="4.2" fill={INK} />
            <ellipse cx="59" cy="52" rx="3.2" ry="4.2" fill={INK} />
          </g>
          <circle cx={C.x} cy={C.y} r="2.2" fill={INK} />
          <path d="M42,68 Q50,75 58,68" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          {/* right arm: waves at the end */}
          <g ref={r.arm}>
            <path d="M82,60 C94,56 96,46 93,38" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
            <path d="M82,60 C94,56 96,46 93,38" fill="none" style={{ stroke: 'rgb(var(--tick-a-rgb))' }} strokeWidth="3.5" strokeLinecap="round" />
            <circle cx="93" cy="35" r="5" fill="#fff" stroke={INK} strokeWidth="2.5" />
          </g>
        </g>
      </svg>
    </div>
    </>
  )
}
