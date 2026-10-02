import { useEffect, useState } from 'react'
import { profile } from '../data.js'
import { scrollToId } from '../hooks.js'

const STEPS = [
  { id: 'top', label: 'Origin', note: `${profile.name} — ${profile.role}` },
  { id: 'experiments', label: 'Experiments', note: 'Selected work with results' },
  { id: 'acts', label: 'Acts', note: 'Career so far' },
  { id: 'system', label: 'System index', note: 'Skills, education, certifications' },
  { id: 'contact', label: 'Contact', note: 'Resume and how to reach me' },
]
const STEP_MS = 9000

export default function Tour({ onEnd }) {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const last = step === STEPS.length - 1

  useEffect(() => {
    scrollToId(STEPS[step].id)
  }, [step])

  useEffect(() => {
    if (paused || last) return
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS)
    return () => clearTimeout(t)
  }, [step, paused, last])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onEnd()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onEnd])

  return (
    <div className="tour" role="region" aria-label="Auto tour">
      <div className="tour-progress" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s.id}
            className={i < step ? 'done' : i === step ? `now${paused || last ? ' hold' : ''}` : ''}
            style={{ '--dur': `${STEP_MS}ms` }}
          />
        ))}
      </div>
      <p className="tour-text" aria-live="polite">
        <span className="mono amber">
          {String(step + 1).padStart(2, '0')}/{String(STEPS.length).padStart(2, '0')}
        </span>{' '}
        <strong>{STEPS[step].label}</strong> <span className="dim">— {STEPS[step].note}</span>
      </p>
      <div className="tour-actions">
        <button type="button" className="chip" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </button>
        {!last && (
          <button type="button" className="chip" onClick={() => setPaused((p) => !p)}>
            {paused ? 'Play' : 'Pause'}
          </button>
        )}
        {last ? (
          <a className="chip chip-primary" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
            Download resume
          </a>
        ) : (
          <button type="button" className="chip" onClick={() => setStep((s) => s + 1)}>
            Next
          </button>
        )}
        <button type="button" className="chip" onClick={onEnd} aria-label="End tour">
          ✕
        </button>
      </div>
    </div>
  )
}
