import { useEffect, useRef, useState } from 'react'
import { profile } from '../data.js'

const LINKS = [
  ['#experiments', 'Work'],
  ['#acts', 'Journey'],
  ['#system', 'Skills'],
  ['#contact', 'Contact'],
]

function Switch({ recruiter, onToggle, className = '', children }) {
  return (
    <button type="button" className={`chip switch ${className}`} role="switch" aria-checked={recruiter} onClick={onToggle}>
      <span className="switch-track" aria-hidden="true">
        <span className="switch-dot" />
      </span>
      {children}
    </button>
  )
}

export default function Nav({ recruiter, onToggleRecruiter, onPalette, onTour }) {
  // The menu sheet for screens too narrow for the section links (the burger button).
  const [open, setOpen] = useState(false)
  const header = useRef(null)
  const burger = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      burger.current?.focus()
    }
    const onDown = (e) => !header.current?.contains(e.target) && setOpen(false)
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <header className="nav" ref={header}>
      <a href="#top" className="wordmark">
        Tarun<span aria-hidden="true">·</span>
        <span className="sr-only"> </span>Kullolli<span className="sr-only">, back to top</span>
      </a>

      {!recruiter && (
        <nav aria-label="Sections" className="nav-links">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>
      )}

      <div className="nav-actions mono">
        <Switch recruiter={recruiter} onToggle={onToggleRecruiter} className="nav-switch">
          <span className="nav-label-xs">Recruiter</span>
          <span className="hide-sm">&nbsp;mode</span>
        </Switch>
        <a className="chip chip-cta" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
          Resume <span aria-hidden="true">↓</span>
        </a>
        <button type="button" className="icon-btn" onClick={onPalette} aria-label="Open command menu (Ctrl+K)" title="Command menu (Ctrl+K)">
          <span aria-hidden="true">⌘</span>
        </button>
        <button
          ref={burger}
          type="button"
          className="icon-btn nav-burger"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="nav-sheet"
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`burger-bars${open ? ' is-open' : ''}`} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div id="nav-sheet" className="nav-sheet">
          {!recruiter && (
            <nav aria-label="Sections">
              {LINKS.map(([href, label]) => (
                <a key={href} href={href} onClick={close}>
                  {label}
                </a>
              ))}
              <button
                type="button"
                className="sheet-tour"
                onClick={() => {
                  close()
                  onTour()
                }}
              >
                <span aria-hidden="true">▶</span> Take the 60-second tour
              </button>
            </nav>
          )}
          <Switch recruiter={recruiter} onToggle={onToggleRecruiter} className="sheet-switch mono">
            Recruiter mode
          </Switch>
        </div>
      )}
    </header>
  )
}
