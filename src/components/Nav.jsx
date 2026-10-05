import { profile } from '../data.js'

const LINKS = [
  ['#experiments', 'Work'],
  ['#acts', 'Journey'],
  ['#system', 'Skills'],
  ['#contact', 'Contact'],
]

export default function Nav({ recruiter, onToggleRecruiter, onPalette }) {
  return (
    <header className="nav">
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
        <button type="button" className="chip switch" role="switch" aria-checked={recruiter} onClick={onToggleRecruiter}>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-dot" />
          </span>
          <span className="nav-label-xs">Recruiter</span>
          <span className="hide-sm">&nbsp;mode</span>
        </button>
        <a className="chip chip-cta" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
          Resume <span aria-hidden="true">↓</span>
        </a>
        <button type="button" className="icon-btn" onClick={onPalette} aria-label="Open command menu (Ctrl+K)" title="Command menu (Ctrl+K)">
          <span aria-hidden="true">⌘</span>
        </button>
      </div>
    </header>
  )
}
