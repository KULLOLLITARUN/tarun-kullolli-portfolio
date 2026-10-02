import { experiments, profile } from '../data.js'

export default function Nav({ recruiter, onToggleRecruiter, onTour, onPalette }) {
  return (
    <header className="nav">
      <a href="#top" className="wordmark" aria-label="Tarun Kullolli, back to top">
        TARUN<span aria-hidden="true">·</span>KULLOLLI
      </a>

      {!recruiter && (
        <nav aria-label="Experiments" className="nav-pills mono">
          {experiments.map((e, i) => {
            const n = String(i + 1).padStart(2, '0')
            return (
              <a key={n} href={`#exp-${n}`} aria-label={`Experiment ${n}: ${e.title}`} title={e.title}>
                {n}
              </a>
            )
          })}
        </nav>
      )}

      <div className="nav-actions mono">
        {!recruiter && (
          <button type="button" className="chip" onClick={onTour}>
            <span className="amber" aria-hidden="true">✦</span> Auto tour
          </button>
        )}
        <button type="button" className="chip switch" role="switch" aria-checked={recruiter} onClick={onToggleRecruiter}>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-dot" />
          </span>
          Recruiter<span className="hide-sm">&nbsp;mode</span>
        </button>
        <a className="chip chip-primary" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
          Resume <span aria-hidden="true">↓</span>
        </a>
        <button type="button" className="chip kbd-chip" onClick={onPalette} aria-label="Open command menu (Ctrl+K)">
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </button>
      </div>
    </header>
  )
}
