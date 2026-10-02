import { certifications, education, skills } from '../data.js'
import SectionHead from './SectionHead.jsx'

export default function SystemIndex() {
  return (
    <section id="system" className="section" aria-labelledby="system-title">
      <SectionHead index="03" kicker="System Index" id="system-title" title="Skills & tools" />

      <div className="system-grid">
        {skills
          .filter((g) => g.items.length)
          .map((g, i) => (
            <div key={g.group} className="system-cell">
              <p className="mono label">
                <span className="amber">{String(i + 1).padStart(2, '0')}</span> <span className="dim">//</span>{' '}
                {g.group.toUpperCase()}
              </p>
              <ul className="tags">
                {g.items.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ))}
      </div>

      <div className="system-split">
        <div>
          <h3 className="mono label">EDUCATION</h3>
          <ul className="plain-list">
            {education.map((e) => (
              <li key={e.school}>
                <span>{e.school}</span>
                <span className="dim">
                  {e.detail} · {e.period}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mono label">CERTIFICATIONS</h3>
          <ul className="plain-list">
            {certifications.map((c) => (
              <li key={c.name}>
                {c.link && c.link !== '#' ? (
                  <a href={c.link} target="_blank" rel="noreferrer">
                    {c.name} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span>{c.name}</span>
                )}
                <span className="dim">{c.issuer}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
