import { useEffect, useRef, useState } from 'react'
import { profile } from '../data.js'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]
function ago(date) {
  const s = (new Date(date) - Date.now()) / 1000
  for (const [unit, secs] of UNITS) if (Math.abs(s) >= secs) return rtf.format(Math.round(s / secs), unit)
  return 'just now'
}

// "Live from GitHub": the latest commits on the project repos (server/github.js). It loads as it
// nears the screen, so it never slows the first paint, and stays hidden if GitHub can't be reached.
export default function GitHubActivity() {
  const ref = useRef(null)
  const [commits, setCommits] = useState(null) // null while loading, [] when unavailable
  const user = profile.links.github.split('/').pop()

  useEffect(() => {
    let alive = true
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        fetch('/api/github')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
          .then((data) => alive && setCommits(data?.commits || []))
      },
      { rootMargin: '600px' },
    )
    io.observe(ref.current)
    return () => {
      alive = false
      io.disconnect()
    }
  }, [])

  return (
    <aside ref={ref} className="gh" aria-labelledby="gh-title" hidden={commits?.length === 0}>
      <header className="gh-head">
        <h3 id="gh-title" className="gh-title mono">
          <span className="pulse" aria-hidden="true" /> Live from GitHub
        </h3>
        <a className="gh-profile mono" href={profile.links.github} target="_blank" rel="noreferrer">
          @{user} <span aria-hidden="true">↗</span>
        </a>
      </header>
      <ol className="gh-list" aria-busy={commits === null}>
        {commits?.map((c) => (
          <li key={c.url}>
            <a className="gh-row" href={c.url} target="_blank" rel="noreferrer">
              <span className="gh-repo mono">{c.repo}</span>
              <span className="gh-msg">{c.message}</span>
              <time className="gh-when mono" dateTime={c.date}>
                {ago(c.date)}
              </time>
            </a>
          </li>
        ))}
      </ol>
    </aside>
  )
}
