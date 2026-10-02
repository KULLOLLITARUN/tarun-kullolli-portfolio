import { useEffect, useRef } from 'react'
import { useReducedMotion } from '../hooks.js'

const INTERACTIVE = 'a, button, [role="button"], [role="option"], [role="switch"], summary, label'
const TEXT = 'input, textarea, [contenteditable="true"]'
const TRAIL = 8
const IDLE = 26 // size of the idle bracket box (px)
const PAD = 6 // padding around a detected element (px)

// What the "model" calls the element under the cursor.
function classify(el) {
  if (el.matches('a')) return 'link'
  if (el.getAttribute('role') === 'switch') return 'toggle'
  if (el.getAttribute('role') === 'option') return 'command'
  return 'button'
}
// Stable pseudo-confidence per element, so the label doesn't flicker.
function confidence(el) {
  const s = (el.textContent || el.getAttribute('aria-label') || '').trim()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return (0.9 + (Math.abs(h) % 10) / 100).toFixed(2)
}

// "AI detection" cursor: an amber core inside corner brackets with a spark trail.
// Over interactive elements the brackets snap around the element like an
// object-detection bounding box, labelled with a class and confidence.
// Only on fine pointers (mouse / trackpad); touch keeps the default.
export default function Cursor() {
  const box = useRef(null)
  const label = useRef(null)
  const core = useRef(null)
  const sparks = useRef([])
  const reduce = useReducedMotion()

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const root = document.documentElement
    root.classList.add('has-cursor')

    const ptr = { x: -200, y: -200 }
    const rect = { x: -200, y: -200, w: IDLE, h: IDLE } // centre-based
    const trail = Array.from({ length: TRAIL }, () => ({ x: -200, y: -200 }))
    let target = null
    let visible = false
    let press = 0
    let raf = 0
    let last = performance.now()

    const show = (v) => {
      if (v === visible) return
      visible = v
      for (const el of [box.current, core.current, ...sparks.current]) el?.classList.toggle('is-hidden', !v)
    }
    const onMove = (e) => {
      if (!visible) {
        rect.x = e.clientX
        rect.y = e.clientY
        trail.forEach((p) => {
          p.x = e.clientX
          p.y = e.clientY
        })
      }
      ptr.x = e.clientX
      ptr.y = e.clientY
      const el = e.target instanceof Element ? e.target : null
      if (el?.closest(TEXT)) {
        target = null
        show(false)
        return
      }
      show(true)
      const next = el?.closest(INTERACTIVE) || null
      if (next !== target) {
        target = next
        box.current?.classList.toggle('is-locked', !!target)
        if (target && label.current) label.current.textContent = `${classify(target)} · ${confidence(target)}`
      }
    }
    const onDown = () => (press = 1)
    const onLeave = () => show(false)

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const ease = (speed) => (reduce ? 1 : 1 - Math.exp(-dt * speed))

      // Goal box: the detected element, or a small box around the pointer.
      let gx = ptr.x
      let gy = ptr.y
      let gw = IDLE
      let gh = IDLE
      if (target && target.isConnected) {
        const r = target.getBoundingClientRect()
        gx = r.left + r.width / 2
        gy = r.top + r.height / 2
        gw = r.width + PAD * 2
        gh = r.height + PAD * 2
      }
      const k = ease(target ? 16 : 22)
      rect.x += (gx - rect.x) * k
      rect.y += (gy - rect.y) * k
      rect.w += (gw - rect.w) * k
      rect.h += (gh - rect.h) * k
      press = Math.max(0, press - dt * 4)
      const s = 1 - press * 0.12

      if (box.current) {
        // Not enough room above (e.g. the nav)? Show the label under the box instead.
        box.current.classList.toggle('label-below', rect.y - rect.h / 2 < 28)
        box.current.style.transform = `translate3d(${rect.x - rect.w / 2}px, ${rect.y - rect.h / 2}px, 0) scale(${s})`
        box.current.style.width = `${rect.w}px`
        box.current.style.height = `${rect.h}px`
      }
      if (core.current) core.current.style.transform = `translate3d(${ptr.x}px, ${ptr.y}px, 0) translate(-50%, -50%)`

      // Spark trail: each point chases the one before it.
      trail.forEach((p, i) => {
        const lead = i === 0 ? ptr : trail[i - 1]
        const kk = ease(30 - i * 2.2)
        p.x += (lead.x - p.x) * kk
        p.y += (lead.y - p.y) * kk
        const el = sparks.current[i]
        if (el) el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${1 - i / TRAIL})`
      })
      raf = requestAnimationFrame(frame)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      root.classList.remove('has-cursor')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [reduce])

  return (
    <div className="cursor" aria-hidden="true">
      {Array.from({ length: TRAIL }, (_, i) => (
        <span
          key={i}
          ref={(el) => (sparks.current[i] = el)}
          className="cursor-spark is-hidden"
          style={{ opacity: 0.55 * (1 - i / TRAIL) }}
        />
      ))}
      <div ref={box} className="cursor-box is-hidden">
        <i className="tl" />
        <i className="tr" />
        <i className="bl" />
        <i className="br" />
        <span ref={label} className="cursor-label" />
      </div>
      <span ref={core} className="cursor-core is-hidden" />
    </div>
  )
}
