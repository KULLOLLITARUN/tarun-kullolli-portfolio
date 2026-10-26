import { useEffect, useState } from 'react'
import { profile } from '../data.js'
import { scrollToId, scrollToStation, useNarrow } from '../hooks.js'

// `line` is what Kairo says (facts from the project READMEs and résumé only); `target` is the
// element it looks at, and decides which side of the screen it parks on.
const STEPS = [
  {
    id: 'top',
    label: 'Origin',
    note: `${profile.name} — ${profile.role}`,
    line: "I'm Kairo. Let me show you Tarun's work. It takes about a minute.",
  },
  {
    id: 'experiments',
    target: '#exp-01',
    card: 'exp-01', // phones stack the cards, so scroll to this one
    label: 'Archiva',
    note: 'Self-healing agentic RAG',
    line: 'Archiva answers only from your own documents, and retries and repairs its own failures. 523 tests run in CI.',
  },
  {
    id: 'experiments',
    target: '#exp-02',
    card: 'exp-02', // phones stack the cards, so scroll to this one
    label: 'PBIP Sentinel',
    note: 'Quality gate for Power BI projects',
    line: 'PBIP Sentinel audits Power BI projects: 94 of 94 findings were true positives across 11 real models.',
  },
  {
    id: 'experiments',
    target: '#exp-03',
    card: 'exp-03', // phones stack the cards, so scroll to this one
    label: 'Markpull',
    note: 'Plain-English web extraction',
    line: 'Markpull turns a web page into structured data from a plain-English request, with every record marked on the page.',
  },
  {
    id: 'acts',
    target: '#acts',
    label: 'Acts',
    note: 'Career so far',
    line: 'Three acts: a CS degree, a full-stack internship, and now AI Engineer at Quintesys.',
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
