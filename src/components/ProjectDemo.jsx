import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from '../hooks.js'

const STEP_MS = 2400
const END_HOLD_MS = 3200

// A short, looping walk through how a project works, from data.js `demo`:
//   steps: [{ stage, line, branch?, loop? }]  (stages appear in order; `branch` is a side outcome,
//          `loop` says where a retry goes back to)
//   notes: ['Side facts shown under the pipeline']
// It plays only while on screen and never when the visitor prefers reduced motion.
export default function ProjectDemo({ title, demo }) {
  const reduce = useReducedMotion()
  const { steps, notes = [] } = demo
  const stages = [...new Set(steps.map((s) => s.stage))]
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(!reduce)
  const [inView, setInView] = useState(false)
  const root = useRef(null)
  const last = steps.length - 1
  const step = steps[i]
  const now = stages.indexOf(step.stage)

  useEffect(() => {
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return setInView(true)
    const io = new IntersectionObserver(([en]) => setInView(en.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!playing || !inView || reduce) return
    const t = setTimeout(() => setI((n) => (n >= last ? 0 : n + 1)), i === last ? END_HOLD_MS : STEP_MS)
    return () => clearTimeout(t)
  }, [i, playing, inView, reduce, last])

  const go = (n) => {
    setPlaying(false)
    setI(Math.max(0, Math.min(last, n)))
  }

  return (
    <section ref={root} className="pd-sec pd-demo" aria-label={`How ${title} works, step by step`}>
      <h4 className="pd-label mono">How it works</h4>

      <ol className="demo-nodes" aria-hidden="true">
        {stages.map((s, k) => (
          <li key={s} className={k < now ? 'done' : k === now ? 'now' : ''}>
            <span className="mono">{String(k + 1).padStart(2, '0')}</span> {s}
            {k === now && step.branch && <em className="demo-chip demo-branch">{step.branch}</em>}
            {k === now && step.loop && <em className="demo-chip demo-loop">↺ retry from {step.loop}</em>}
          </li>
        ))}
      </ol>
      <div className="demo-track" aria-hidden="true">
        <span style={{ width: `${(now / Math.max(1, stages.length - 1)) * 100}%` }} />
      </div>

      <p className="demo-line" aria-live={playing ? 'off' : 'polite'}>
        <span className="mono amber">
          {String(i + 1).padStart(2, '0')}/{String(steps.length).padStart(2, '0')}
        </span>{' '}
        <strong>{step.stage}</strong> <span className="dim">— {step.line}</span>
      </p>

      <div className="demo-controls">
        <button type="button" className="chip" onClick={() => go(i - 1)} disabled={i === 0}>
          Back
        </button>
        <button
          type="button"
          className="chip"
          onClick={() => {
            if (!playing && i === last) setI(0)
            setPlaying((p) => !p)
          }}
        >
          {playing ? 'Pause' : i === last ? 'Replay' : 'Play'}
        </button>
        <button type="button" className="chip" onClick={() => go(i + 1)} disabled={i === last}>
          Next
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="demo-notes mono">
          {notes.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      <ol className="sr-only">
        {steps.map((s) => (
          <li key={s.stage + s.line}>
            {s.stage}: {s.line}
          </li>
        ))}
      </ol>
    </section>
  )
}
