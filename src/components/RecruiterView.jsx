import { acts, certifications, currentJob, education, experiments, profile, skills } from '../data.js'
import { ContactLinks } from './Contact.jsx'

// Plain one-page summary: everything a recruiter needs, no effects.
export default function RecruiterView({ onCopyEmail }) {
  const jobs = acts.filter((a) => a.name !== 'Next' && a.name !== 'Foundations')
  return (
    <article id="top" className="recruiter" aria-labelledby="rv-name">
      <header className="rv-head">
        <div>
          <h1 id="rv-name">{profile.name}</h1>
          <p className="rv-role">
            {currentJob ? `${currentJob.title} · ${currentJob.org}` : profile.role}
          </p>
        </div>
        <div className="rv-actions">
          <button type="button" className="btn" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <a className="btn btn-primary" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
            Download resume
          </a>
        </div>
      </header>
      <ContactLinks onCopyEmail={onCopyEmail} />

      <section aria-labelledby="rv-summary">
        <h2 id="rv-summary">Summary</h2>
        <p>{profile.summary}</p>
      </section>

      <section aria-labelledby="rv-exp">
        <h2 id="rv-exp">Experience</h2>
        {jobs.map((j) => (
          <div key={j.title} className="rv-item">
            <p className="rv-line">
              <strong>
                {j.title} · {j.org}
              </strong>
              <span className="dim">{j.period}</span>
            </p>
            <ul>
              {j.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="rv-projects">
        <h2 id="rv-projects">Projects</h2>
        {experiments.map((e) => (
          <div key={e.title} className="rv-item">
            <p className="rv-line">
              <strong>{e.title}</strong>
              <span className="dim">{e.stack.join(' · ')}</span>
            </p>
            <p>
              {e.description} <span className="rv-result">{e.result}.</span>
            </p>
          </div>
        ))}
      </section>

      <section aria-labelledby="rv-skills">
        <h2 id="rv-skills">Skills</h2>
        <dl className="rv-skills">
          {skills
            .filter((g) => g.items.length)
            .map((g) => (
              <div key={g.group}>
                <dt>{g.group}</dt>
                <dd>{g.items.join(', ')}</dd>
              </div>
            ))}
        </dl>
      </section>

      <section aria-labelledby="rv-edu">
        <h2 id="rv-edu">Education & certifications</h2>
        <ul className="plain-list">
          {education.map((e) => (
            <li key={e.school}>
              <span>{e.school}</span>
              <span className="dim">
                {e.detail} · {e.period}
              </span>
            </li>
          ))}
          {certifications.map((c) => (
            <li key={c.name}>
              <span>{c.name}</span>
              <span className="dim">{c.issuer}</span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
