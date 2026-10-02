import { useMemo } from 'react'
import { experiments } from '../data.js'
import SectionHead from './SectionHead.jsx'

function rng(seed) {
  let s = (seed + 1) * 9973
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// Generative wave "specimen": a deterministic SVG per experiment, no image downloads.
function Specimen({ seed }) {
  const paths = useMemo(() => {
    const r = rng(seed)
    const freq = 1 + r() * 2.5
    const amp = 8 + r() * 14
    const twist = 0.15 + r() * 0.5
    const out = []
    for (let i = 0; i < 18; i++) {
      const y0 = 10 + i * 6.4
      const ph = r() * 0.6 + i * twist
      let d = ''
      for (let x = 0; x <= 240; x += 6) {
        const env = Math.sin((x / 240) * Math.PI)
        const y = y0 + Math.sin((x / 240) * Math.PI * 2 * freq + ph) * amp * env
        d += `${x ? 'L' : 'M'}${x} ${y.toFixed(1)} `
      }
      out.push(d)
    }
    return out
  }, [seed])
  return (
    <svg className="specimen" viewBox="0 0 240 130" preserveAspectRatio="none" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} style={{ '--i': i }} />
      ))}
    </svg>
  )
}

export default function Experiments() {
  return (
    <section id="experiments" className="section" aria-labelledby="experiments-title">
      <SectionHead index="01" kicker="The Experiments" id="experiments-title" title="Selected work">
        Each build is a small system: a problem, an approach, a measurable result.
      </SectionHead>

      <ol className="exp-grid">
        {experiments.map((e, i) => {
          const n = String(i + 1).padStart(2, '0')
          const links = Object.entries(e.links || {}).filter(([, url]) => url && url !== '#')
          return (
            <li key={n} id={`exp-${n}`} className="exp-card">
              <Specimen seed={i} />
              <div className="exp-body">
                <p className="mono label">
                  <span className="amber">EXP {n}</span> <span className="dim">//</span> {e.code}
                </p>
                <h3>{e.title}</h3>
                <p className="exp-sub">{e.subtitle}</p>
                <p className="exp-desc">{e.description}</p>
                <ul className="tags" aria-label="Tech stack">
                  {e.stack.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                <p className="exp-result">
                  <span className="mono label dim">RESULT</span>
                  {e.result}
                </p>
                {links.length > 0 && (
                  <p className="exp-links">
                    {links.map(([kind, url]) => (
                      <a key={kind} href={url} target="_blank" rel="noreferrer">
                        {kind === 'code' ? 'View code' : 'Live demo'} — {e.title} <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
