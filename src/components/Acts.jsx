import { acts } from '../data.js'
import SectionHead from './SectionHead.jsx'

const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

export default function Acts() {
  return (
    <section id="acts" className="section" aria-labelledby="acts-title">
      <SectionHead index="02" kicker="The Acts" id="acts-title" title={`Career in ${COUNT[acts.length] || acts.length} acts`}>
        From computer science fundamentals to full-stack development, and now AI engineering in production.
      </SectionHead>

      <ol className="acts" style={{ '--acts': acts.length }}>
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
