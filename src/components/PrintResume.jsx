import { acts, certifications, education, experiments, profile, skills } from '../data.js'

// The page that prints (Ctrl+P, or "Print / Save as PDF" in recruiter mode): a conventional
// one-page résumé laid out like Tarun's own resume.pdf: summary, education, skills, experience,
// projects, certifications, with dated entries oldest first. Everything comes from data.js.
// Only mounted while printing (App.jsx); styled under "Print résumé" in styles.css.

const startOf = (period) => {
  const t = Date.parse(`1 ${period.split(/[–-]/)[0].trim()}`)
  return Number.isNaN(t) ? 0 : t
}
const jobs = acts
  .filter((a) => a.name !== 'Next' && a.name !== 'Foundations')
  .sort((a, b) => startOf(a.period) - startOf(b.period))
const bare = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')

function Entry({ title, detail, date, children }) {
  return (
    <div className="pr-entry">
      <p className="pr-entry-head">
        <span>
          <strong>{title}</strong>
          {detail && <em> {detail}</em>}
        </span>
        {date && <span className="pr-date">{date}</span>}
      </p>
      {children}
    </div>
  )
}

// "Live demo · Code on GitHub", whichever the project has (links set to '#' are hidden).
function ProjectLinks({ links = {} }) {
  const items = [
    ['Live demo', links.live],
    ['Code on GitHub', links.code],
  ].filter(([, url]) => url && url !== '#')
  return items.map(([label, url], i) => (
    <span key={label}>
      {i > 0 && ' · '}
      <a href={url}>{label}</a>
    </span>
  ))
}

export default function PrintResume() {
  const contact = [
    { text: profile.email, href: `mailto:${profile.email}` },
    { text: profile.phone, href: `tel:${profile.phone.replace(/\s/g, '')}` },
    ...Object.values(profile.links)
      .filter((url) => url && url !== '#')
      .map((url) => ({ text: bare(url), href: url })),
  ]

  return (
    <article className="pr" aria-label="Résumé">
      <header className="pr-head">
        <h1>{profile.name}</h1>
        <p className="pr-role">{profile.role}</p>
        <p className="pr-contact">
          {contact.map((c, i) => (
            <span key={c.href}>
              {i > 0 && <span className="pr-sep"> | </span>}
              <a href={c.href}>{c.text}</a>
            </span>
          ))}
        </p>
      </header>

      <section>
        <h2>Summary</h2>
        <p>{profile.summary}</p>
      </section>

      <section>
        <h2>Education</h2>
        {[...education].reverse().map((e) => (
          <Entry key={e.school} title={e.school} date={e.period}>
            <ul>
              <li>{e.detail.replace(' · ', ' (') + (e.detail.includes(' · ') ? ')' : '')}</li>
            </ul>
          </Entry>
        ))}
      </section>

      <section>
        <h2>Skills</h2>
        <ul>
          {skills
            .filter((g) => g.items.length)
            .map((g) => (
              <li key={g.group}>
                <strong>{g.group}:</strong> {g.items.join(', ')}
              </li>
            ))}
        </ul>
      </section>

      <section>
        <h2>Experience</h2>
        {jobs.map((j) => (
          <Entry key={j.title} title={`${j.title} | ${j.org}`} date={j.period}>
            <ul>
              {j.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Entry>
        ))}
      </section>

      <section>
        <h2>Projects</h2>
        {experiments.map((e) => (
          <Entry
            key={e.title}
            title={e.title}
            detail={`(${e.stack.join(', ')})`}
            date={<ProjectLinks links={e.links} />}
          >
            <ul>
              <li>{e.description}</li>
              {e.result && <li>{e.result}.</li>}
            </ul>
          </Entry>
        ))}
      </section>

      {certifications.length > 0 && (
        <section>
          <h2>Certifications</h2>
          <ul>
            {certifications.map((c) => (
              <li key={c.name}>
                {c.name} – {c.issuer}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
