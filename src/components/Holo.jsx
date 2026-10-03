import { useMemo } from 'react'

// Shared "holographic" visuals used by the project cards and the project panel.

export function rng(seed) {
  let s = (seed + 1) * 9973
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// The tech stack drawn as a small system diagram: nodes linked by "data flow" lines.
export function StackFlow({ stack, seed }) {
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

export function Sparkline({ trend = 'up', seed }) {
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

// URL-friendly id for a project, used in #project/<slug> links.
export const projectSlug = (e) => e.slug || e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Real links only ('#' placeholders are hidden).
export const projectLinks = (e) => Object.entries(e.links || {}).filter(([, url]) => url && url !== '#')
