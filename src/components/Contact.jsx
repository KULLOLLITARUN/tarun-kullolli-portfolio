import { profile } from '../data.js'

export function ContactLinks({ onCopyEmail }) {
  const { links } = profile
  return (
    <ul className="contact-links">
      <li>
        <a href={`mailto:${profile.email}`}>{profile.email}</a>
        <button type="button" className="chip" onClick={onCopyEmail}>
          Copy email
        </button>
      </li>
      <li>
        <a href={`tel:${profile.phone.replace(/\s/g, '')}`}>{profile.phone}</a>
      </li>
      {links.linkedin !== '#' && (
        <li>
          <a href={links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn <span aria-hidden="true">↗</span>
          </a>
        </li>
      )}
      {links.github !== '#' && (
        <li>
          <a href={links.github} target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </li>
      )}
    </ul>
  )
}

export default function Contact({ onCopyEmail }) {
  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <p className="kicker mono">04 / Contact</p>
      <h2 id="contact-title" className="contact-title">
        Let’s build something <em>intelligent</em>.
      </h2>
      <div className="contact-row">
        <a className="btn btn-primary" href={profile.resume} download="Tarun-Kullolli-Resume.pdf">
          Download resume
        </a>
        <a className="btn" href={`mailto:${profile.email}`}>
          Email me
        </a>
      </div>
      <ContactLinks onCopyEmail={onCopyEmail} />
    </section>
  )
}
