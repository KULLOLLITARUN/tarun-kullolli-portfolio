import { acts } from '../data.js'
import SectionHead from './SectionHead.jsx'

export default function Acts() {
  return (
    <section id="acts" className="section" aria-labelledby="acts-title">
      <SectionHead index="02" kicker="The Acts" id="acts-title" title="Career in four acts">
        From computer science fundamentals to production Python, and on to AI engineering.
      </SectionHead>

      <ol className="acts">
        {acts.map((a) => (
          <li key={a.act} className={`act${a.name === 'Next' ? ' act-next' : ''}`}>
            <p className="mono label">
              <span className="amber">ACT {a.act}</span> <span className="dim">//</span> {a.name.toUpperCase()}
            </p>
            <p className="act-period mono dim">{a.period}</p>
            <h3>{a.title}</h3>
            <p className="act-org">{a.org}</p>
            <ul>
              {a.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}
