// Shared "holographic" visuals used by the project cards and the project panel.

function rng(seed) {
  let s = (seed + 1) * 9973
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646
}

// A project's pipeline (or its stack) drawn as a small system diagram: nodes linked by
// "data flow" lines, in order.
export function StackFlow({ stack, seed }) {
  const nodes = stack.slice(0, 6)
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

// URL-friendly id for a project, used in #project/<slug> links.
export const projectSlug = (e) => e.slug || e.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// Real links only ('#' placeholders are hidden).
export const projectLinks = (e) => Object.entries(e.links || {}).filter(([, url]) => url && url !== '#')
