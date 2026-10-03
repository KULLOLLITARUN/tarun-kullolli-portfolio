import { acts } from '../data.js'
import SectionHead from './SectionHead.jsx'
import TimelineTick from './TimelineTick.jsx'

const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six']

export default function Acts() {
  return (
    <section id="acts" className="section" aria-labelledby="acts-title">
      <SectionHead index="02" kicker="The Acts" id="acts-title" title={`Career in ${COUNT[acts.length] || acts.length} acts`}>
        From computer science fundamentals to full-stack development, and now AI engineering in production.
      </SectionHead>

      {/* The particle scene draws this timeline (#acts .acts); a mini Tick walks along it. */}
      <div className="acts-wrap">
        <ol className="acts" style={{ '--acts': acts.length }}>
          {acts.map((a, i) => {
            const now = /present/i.test(a.period)
            return (
              <li key={a.act} className={`act${now ? ' is-now' : ''}`}>
                {now && <span className="act-now mono">Now</span>}
                <div className="act-panel">
                  <span className="act-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
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
                </div>
              </li>
            )
          })}
        </ol>
        <TimelineTick />
      </div>
    </section>
  )
}
