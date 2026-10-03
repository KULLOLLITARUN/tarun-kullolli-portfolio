import { useEffect, useRef } from 'react'
import { scrollToId } from '../hooks.js'
import { StackFlow, projectLinks } from './Holo.jsx'

function Section({ label, children, className = '' }) {
  return (
    <section className={`pd-sec ${className}`}>
      <h4 className="pd-label mono">{label}</h4>
      {children}
    </section>
  )
}

// Scroll up to the hero and put the question to the resume assistant (see Chat.jsx).
function askKairo(question) {
  scrollToId('top')
  window.dispatchEvent(new CustomEvent('ask-kairo', { detail: question }))
}

const Bullets =({ items }) => (
  <ul className="pd-list">
    {items.map((t) => (
      <li key={t}>{t}</li>
    ))}
  </ul>
)

// Detailed card for one project, shown in place of the project grid.
// Story (what and why) on the left, evidence (metric, architecture, stack) on the right.
// Sections without content in data.js are hidden.
export default function ProjectDetail({ project: e, index, onClose }) {
  const title = useRef(null)
  const n = String(index + 1).padStart(2, '0')
  const links = projectLinks(e)
  const m = e.metric
  const results = e.results?.length ? e.results : [e.result].filter(Boolean)
  const meta = [e.year, e.role].filter(Boolean)

  // Bring the card into view and move focus to its title (for keyboard and screen readers).
  useEffect(() => {
    scrollToId('project-detail')
    title.current?.focus({ preventScroll: true })
  }, [index])

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <article id="project-detail" className="holo pd" aria-labelledby="pd-title">
      <header className="pd-head">
        <p className="holo-top mono">
          <span className="amber">EXP {n}</span> <span aria-hidden="true">//</span> {e.code}
          {meta.map((t) => (
            <span key={t}> · {t}</span>
          ))}
        </p>
        <div className="pd-actions">
          <button type="button" className="pd-back mono" onClick={onClose}>
            <span aria-hidden="true">←</span> Back
          </button>
          <button type="button" className="pd-close" onClick={onClose} aria-label="Close project">
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <h3 id="pd-title" ref={title} tabIndex={-1}>
          {e.title}
        </h3>
        {e.subtitle && <p className="holo-sub">{e.subtitle}</p>}
      </header>

      <div className="pd-grid">
        <div className="pd-story">
          <Section label="Overview">
            <p>{e.overview || e.description}</p>
          </Section>
          {e.problem && (
            <Section label="Problem">
              <p>{e.problem}</p>
            </Section>
          )}
          {e.approach?.length > 0 && (
            <Section label="Approach">
              <Bullets items={e.approach} />
            </Section>
          )}
          {results.length > 0 && (
            <Section label="Results">
              <Bullets items={results} />
            </Section>
          )}
        </div>

        <aside className="pd-evidence" aria-label="Evidence">
          {m?.value && (
            <div className="holo-metric pd-metric">
              <p>
                <span className="holo-value">{m.value}</span>
                <span className="holo-mlabel mono">{m.label}</span>
              </p>
            </div>
          )}
          <Section label={e.architecture ? 'Architecture' : 'Built with'} className="pd-arch">
            <StackFlow stack={e.architecture || e.stack} seed={index} />
          </Section>
          <Section label="Stack" className="pd-stack">
            <p className="mono">{e.stack.join(' · ')}</p>
          </Section>
        </aside>
      </div>

      <footer className="pd-foot">
        {links.map(([kind, url]) => (
          <a key={kind} className={`btn${kind === 'live' ? ' pd-live' : ''}`} href={url} target="_blank" rel="noreferrer">
            {kind === 'code' ? 'View code' : 'Live demo'} <span aria-hidden="true">↗</span>
          </a>
        ))}
        <button type="button" className="btn pd-ask" onClick={() => askKairo(`Tell me about ${e.title}`)}>
          Ask Kairo about this <span aria-hidden="true">↑</span>
        </button>
        <span className="pd-hint mono">Esc to close</span>
      </footer>
    </article>
  )
}
