import { useMemo } from 'react'
import { experiments } from '../data.js'
import { useReducedMotion } from '../hooks.js'
import SectionHead from './SectionHead.jsx'

function rng(seed) {
  let s = (seed + 1) * 9973
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// The tech stack drawn as a small system diagram: nodes linked by "data flow" lines.
function StackFlow({ stack, seed }) {
  const nodes = stack.slice(0, 5)
  const W = 240
  const width = (label) => Math.max(40, label.length * 5.4 + 14)
  const pts = nodes.map((label, i) => {
    const w = width(label)
    const x = nodes.length === 1 ? W / 2 : 34 + (i * (W - 68)) / (nodes.length - 1)
    // Keep every node fully inside the diagram.
    return { label, w, x: Math.min(W - w / 2 - 6, Math.max(w / 2 + 6, x)), y: i % 2 ? 76 : 34 }
  })
  const r = rng(seed)
  return (
    <svg className="holo-flow" viewBox="0 0 240 110" aria-hidden="true">
      {/* faint grid */}
      {Array.from({ length: 7 }, (_, i) => (
        <line key={`g${i}`} className="holo-grid" x1={i * 40} y1="0" x2={i * 40} y2="110" />
      ))}
      {pts.slice(1).map((p, i) => {
        const a = pts[i]
        const mx = (a.x + p.x) / 2
        const d = `M${a.x},${a.y} C${mx},${a.y} ${mx},${p.y} ${p.x},${p.y}`
        return (
          <g key={`e${i}`}>
            <path className="holo-edge-line" d={d} />
            <path className="holo-pulse" d={d} style={{ animationDelay: `${(i * 0.4 + r()).toFixed(2)}s` }} />
          </g>
        )
      })}
      {pts.map((p) => {
        const { w } = p
        return (
          <g key={p.label} className="holo-node">
            <rect x={p.x - w / 2} y={p.y - 10} width={w} height="20" rx="4" />
            <circle cx={p.x - w / 2 + 7} cy={p.y} r="2" />
            <text x={p.x + 3} y={p.y + 3.2} textAnchor="middle">
              {p.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function Sparkline({ trend = 'up', seed }) {
  const d = useMemo(() => {
    const r = rng(seed + 7)
    const n = 18
    const pts = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1)
      const base = trend === 'down' ? 0.85 - t * 0.6 : trend === 'flat' ? 0.45 : 0.2 + t * 0.6
      const v = Math.min(0.95, Math.max(0.05, base + (r() - 0.5) * 0.18))
      return [t * 100, 34 - v * 30]
    })
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
    return { line, area: `${line} L100,34 L0,34 Z` }
  }, [trend, seed])
  return (
    <svg className="holo-spark" viewBox="0 0 100 34" preserveAspectRatio="none" aria-hidden="true">
      <path className="holo-spark-area" d={d.area} />
      <path className="holo-spark-line" d={d.line} />
    </svg>
  )
}

export default function Experiments() {
  const reduce = useReducedMotion()

  // 3D tilt toward the pointer (mouse only).
  const tilt = (e) => {
    if (reduce || e.pointerType !== 'mouse') return
    const el = e.currentTarget
    const b = el.getBoundingClientRect()
    const px = (e.clientX - b.left) / b.width - 0.5
    const py = (e.clientY - b.top) / b.height - 0.5
    el.style.setProperty('--ry', `${(px * 10).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`)
    el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(1)}%`)
    el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(1)}%`)
  }
  const untilt = (e) => {
    const s = e.currentTarget.style
    s.removeProperty('--ry')
    s.removeProperty('--rx')
  }

  return (
    <section id="experiments" className="section" aria-labelledby="experiments-title">
      <SectionHead index="01" kicker="The Experiments" id="experiments-title" title="Selected work">
        Each build is a small system: a problem, an approach, a measurable result.
      </SectionHead>

      <ol className="holo-grid-list">
        {experiments.map((e, i) => {
          const n = String(i + 1).padStart(2, '0')
          const links = Object.entries(e.links || {}).filter(([, url]) => url && url !== '#')
          const m = e.metric || { value: '', label: e.result }
          return (
            <li key={n} id={`exp-${n}`} className="holo-card" style={{ '--i': i }}>
              <article className="holo" onPointerMove={tilt} onPointerLeave={untilt}>
                <span className="holo-side" aria-hidden="true" />
                <span className="holo-glare" aria-hidden="true" />

                <header className="holo-head">
                  <p className="holo-kicker mono">
                    <span className="amber">EXP {n}</span> <span aria-hidden="true">//</span> {e.code}
                  </p>
                  <h3>{e.title}</h3>
                  <p className="holo-sub">{e.subtitle}</p>
                </header>

                <StackFlow stack={e.stack} seed={i} />

                <div className="holo-metric">
                  <p>
                    <span className="holo-value">{m.value}</span>
                    <span className="holo-mlabel mono">{m.label}</span>
                  </p>
                  <Sparkline trend={m.trend} seed={i} />
                </div>

                <p className="holo-desc">{e.description}</p>
                <ul className="holo-tags" aria-label="Tech stack">
                  {e.stack.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
                {links.length > 0 && (
                  <p className="holo-links">
                    {links.map(([kind, url]) => (
                      <a key={kind} href={url} target="_blank" rel="noreferrer">
                        {kind === 'code' ? 'View code' : 'Live demo'} <span className="sr-only">for {e.title}</span>
                        <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </p>
                )}
              </article>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
