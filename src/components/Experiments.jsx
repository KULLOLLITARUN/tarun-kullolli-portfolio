import { useEffect, useRef, useState } from 'react'
import { experiments } from '../data.js'
import { useReducedMotion } from '../hooks.js'
import SectionHead from './SectionHead.jsx'
import ProjectPanel from './ProjectPanel.jsx'
import { projectSlug } from './Holo.jsx'

const slugs = experiments.map(projectSlug)
// #project/<slug> → index of that project, or null.
function projectFromHash() {
  const m = window.location.hash.match(/^#project\/(.+)$/)
  const i = m ? slugs.indexOf(decodeURIComponent(m[1])) : -1
  return i >= 0 ? i : null
}

export default function Experiments() {
  const reduce = useReducedMotion()
  // Open project panel, synced with the URL so a project can be linked directly.
  const [open, setOpen] = useState(projectFromHash)
  const pushed = useRef(false)

  useEffect(() => {
    const sync = () => {
      pushed.current = false
      setOpen(projectFromHash())
    }
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const openProject = (i) => {
    window.history.pushState(null, '', `#project/${slugs[i]}`)
    pushed.current = true
    setOpen(i)
  }
  // Closing undoes our history entry, so the browser Back button also closes the panel.
  const closeProject = () => {
    if (pushed.current) window.history.back()
    else window.history.replaceState(null, '', window.location.pathname + window.location.search)
    pushed.current = false
    setOpen(null)
  }

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
          // Compact teaser: the details (diagram, metric, links) live in the project panel.
          return (
            <li key={n} id={`exp-${n}`} className="holo-card" style={{ '--i': i }}>
              <article className="holo" onPointerMove={tilt} onPointerLeave={untilt} data-cursor-box>
                <span className="holo-glare" aria-hidden="true" />

                <p className="holo-top mono">
                  <span>
                    <span className="amber">EXP {n}</span> <span aria-hidden="true">//</span> {e.code}
                  </span>
                  <span className="holo-cta" aria-hidden="true">
                    Open case study <span className="holo-arrow">↗</span>
                  </span>
                </p>
                <h3>
                  {/* Stretched over the whole card, so clicking anywhere opens the project. */}
                  <button
                    type="button"
                    className="holo-open"
                    onClick={() => openProject(i)}
                    aria-haspopup="dialog"
                    data-cursor="open"
                  >
                    {e.title}
                  </button>
                </h3>
                <p className="holo-sub">{e.subtitle}</p>

                {e.result && (
                  <p className="holo-outcome">
                    <span className="holo-dot" aria-hidden="true" />
                    {e.result}
                  </p>
                )}
                <p className="holo-stack mono">
                  <span className="sr-only">Built with </span>
                  {e.stack.slice(0, 4).join(' · ')}
                </p>
              </article>
            </li>
          )
        })}
      </ol>

      {open !== null && <ProjectPanel key={open} project={experiments[open]} index={open} onClose={closeProject} />}
    </section>
  )
}
