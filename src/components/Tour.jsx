import { useEffect, useState } from 'react'
import { acts, currentJob, experiments, profile } from '../data.js'
import { scrollToId, scrollToStation, useNarrow } from '../hooks.js'

const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']
const first = acts[0]

// `line` is what Kairo says (facts from the project READMEs and résumé only); `target` is the
// element it looks at, and decides which side of the screen it parks on. One stop per project
// (its tourLine in data.js), so a new project joins the tour on its own.
const STEPS = [
  {
    id: 'top',
    label: 'Origin',
    note: `${profile.name} — ${profile.role}`,
    line: "I'm Kairo. Let me show you Tarun's work. It takes about a minute.",
  },
  ...experiments.map((e, i) => {
    const n = String(i + 1).padStart(2, '0')
    return {
      id: 'experiments',
      target: `#exp-${n}`,
      card: `exp-${n}`, // phones stack the cards, so scroll to this one
      label: e.title,
      note: e.subtitle,
      line: e.tourLine,
    }
  }),
  {
    id: 'acts',
    target: '#acts',
    label: 'Acts',
    note: 'Career so far',
    line: `${COUNT[acts.length] || acts.length} acts, from ${first.title} to ${currentJob.title} at ${currentJob.org.replace(/ Pvt\. Ltd$/, '')}.`.replace(/^./, (c) => c.toUpperCase()),
  },
  {
    id: 'system',
    target: '#system',
    label: 'System index',
    note: 'Skills, education, certifications',
    line: 'Skills and tools, listed only where the projects back them up.',
  },
  {
    id: 'contact',
    target: '#contact',
    label: 'Contact',
    note: 'Resume and how to reach me',
    line: 'That is the tour. Grab the resume or get in touch from here.',
  },
]
const STEP_MS = 9000

export default function Tour({ onEnd }) {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const last = step === STEPS.length - 1
  const narrow = useNarrow()

  useEffect(() => {
    const { card } = STEPS[step]
    if (card && narrow) scrollToId(card)
    else scrollToStation(STEPS[step].id)
    const { line, target } = STEPS[step]
    window.dispatchEvent(new CustomEvent('kairo-tour', { detail: { line, target } }))
  }, [step])
  useEffect(() => () => window.dispatchEvent(new Event('kairo-tour-end')), [])

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
            key={i}
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
