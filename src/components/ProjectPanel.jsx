import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll, useReducedMotion } from '../hooks.js'
import { Sparkline, StackFlow, projectLinks } from './Holo.jsx'

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function Section({ label, children }) {
  return (
    <section className="pp-sec">
      <h3 className="pp-label mono">{label}</h3>
      <div className="pp-content">{children}</div>
    </section>
  )
}

// Case-study panel for one project. Sections without content in data.js are hidden.
export default function ProjectPanel({ project: e, index, onClose }) {
  const reduce = useReducedMotion()
  const [closing, setClosing] = useState(false)
  const panel = useRef(null)
  const closeBtn = useRef(null)

  const n = String(index + 1).padStart(2, '0')
  const links = projectLinks(e)
  const m = e.metric
  const results = e.results?.length ? e.results : [e.result].filter(Boolean)
  const meta = [e.year, e.role].filter(Boolean)

  useEffect(() => {
    const opener = document.activeElement
    lockScroll(true)
    closeBtn.current?.focus({ preventScroll: true })
    return () => {
      lockScroll(false)
      opener?.focus?.({ preventScroll: true })
    }
  }, [])

  const close = () => {
    if (closing) return
    if (reduce) {
      onClose()
      return
    }
    setClosing(true)
    setTimeout(onClose, 220)
  }

  const onKeyDown = (ev) => {
    if (ev.key === 'Escape') {
      ev.preventDefault()
      close()
    } else if (ev.key === 'Tab') {
      // Keep focus inside the dialog.
      const items = [...panel.current.querySelectorAll(FOCUSABLE)]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault()
        last.focus()
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault()
        first.focus()
      }
    }
  }

  return createPortal(
    <div className={`pp-backdrop${closing ? ' is-closing' : ''}`} onMouseDown={close}>
      <div
        ref={panel}
        className="pp"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-title"
        onMouseDown={(ev) => ev.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="pp-head">
          <div className="holo-head">
            <p className="holo-kicker mono">
              <span className="amber">EXP {n}</span> <span aria-hidden="true">//</span> {e.code}
              {meta.map((t) => (
                <span key={t}> · {t}</span>
              ))}
            </p>
            <h2 id="pp-title">{e.title}</h2>
            {e.subtitle && <p className="holo-sub">{e.subtitle}</p>}
          </div>
          <button ref={closeBtn} type="button" className="pp-close" onClick={close} aria-label="Close project">
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        <div className="pp-body" role="region" aria-label={`${e.title} details`} tabIndex={0} data-lenis-prevent>
          {m?.value && (
            <div className="holo-metric pp-metric">
              <p>
                <span className="holo-value">{m.value}</span>
                <span className="holo-mlabel mono">{m.label}</span>
              </p>
              <Sparkline trend={m.trend} seed={index} />
            </div>
          )}

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
              <ul className="pp-list">
                {e.approach.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Section>
          )}
          <Section label="Architecture">
            <StackFlow stack={e.stack} seed={index} />
            {/* The diagram shows up to five nodes; list the full stack only when it is longer. */}
            {e.stack.length > 5 && (
              <ul className="holo-tags pp-tags" aria-label="Tech stack">
                {e.stack.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            )}
          </Section>
          {results.length > 0 && (
            <Section label="Results">
              <ul className="pp-list">
                {results.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        <footer className="pp-foot">
          {links.map(([kind, url]) => (
            <a key={kind} className={`btn${kind === 'live' ? ' pp-live' : ''}`} href={url} target="_blank" rel="noreferrer">
              {kind === 'code' ? 'View code' : 'Live demo'} <span aria-hidden="true">↗</span>
            </a>
          ))}
          <span className="pp-hint mono">Esc to close</span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
