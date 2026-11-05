import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { profile } from '../data.js'
import { scrollToId } from '../hooks.js'

// Sparks that stream from the rocket up to the top of the screen while the page scrolls up.
const SPARKS = ['#ffd27a', '#ffb340', '#ff7a10', '#fffdf8', '#7dd3fc']
function spray(btn) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const r = btn.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const made = []
  // Safety net: if an animation never finishes (tab hidden mid-flight), still clean everything up.
  setTimeout(() => made.forEach((n) => n.remove()), 3000)
  for (let i = 0; i < 70; i++) {
    const s = document.createElement('span')
    made.push(s)
    const size = 1.5 + Math.random() * 2, len = 14 + Math.random() * 34
    s.setAttribute('aria-hidden', 'true')
    s.style.cssText = `position:fixed;left:${cx - size / 2}px;top:${cy}px;width:${size}px;height:${len}px;border-radius:${size}px;pointer-events:none;z-index:39;background:${SPARKS[i % SPARKS.length]};box-shadow:0 0 8px ${SPARKS[i % SPARKS.length]}`
    document.body.appendChild(s)
    const dx = (Math.random() - 0.5) * 56
    const rise = cy + 40 + Math.random() * 60
    const a = s.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.4}px,${-rise * 0.5}px) scale(1,1.4)`, opacity: 0.9, offset: 0.5 },
        { transform: `translate(${dx}px,${-rise}px) scale(1,2.2)`, opacity: 0 },
      ],
      { duration: 560 + Math.random() * 420, delay: 220 + i * 10, easing: 'cubic-bezier(0.55, 0, 1, 0.45)', fill: 'backwards' },
    )
    a.onfinish = () => s.remove()
  }
  // The rocket itself: a copy lifts off from the button and shoots up past the top of the screen.
  const icon = btn.querySelector('.rocket-icon')
  if (!icon) return
  const ship = icon.cloneNode(true)
  const ir = icon.getBoundingClientRect()
  ship.style.cssText = `position:fixed;left:${ir.left}px;top:${ir.top}px;width:${ir.width}px;height:${ir.height}px;overflow:visible;pointer-events:none;z-index:41`
  document.body.appendChild(ship)
  made.push(ship)
  const flame = ship.querySelector('.rocket-flame')
  if (flame) {
    flame.style.transformBox = 'fill-box'
    flame.style.transformOrigin = '50% 0'
    flame.animate([{ transform: 'scaleY(1.2)' }, { transform: 'scaleY(2.2)' }], { duration: 90, direction: 'alternate', iterations: Infinity })
  }
  const flight = ship.animate(
    [
      { transform: 'translate(0,0) rotate(0deg)' },
      { transform: 'translate(0,-12px) rotate(-2deg)', offset: 0.15 },
      { transform: `translate(0,${-(ir.top + ir.height + 80)}px) rotate(1deg)` },
    ],
    { duration: 950, easing: 'cubic-bezier(0.55, 0, 0.9, 0.5)', fill: 'forwards' },
  )
  flight.onfinish = () => ship.remove()
}

// A small rocket that appears only while the Contact section is on screen and flies you back up.
function RocketTop() {
  const [show, setShow] = useState(false)
  const [launch, setLaunch] = useState(false)
  const launchTimer = useRef(null)
  useEffect(() => {
    const el = document.getElementById('contact')
    if (!el || !('IntersectionObserver' in window)) return undefined
    const io = new IntersectionObserver(([e]) => setShow(e.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(launchTimer.current)
    }
  }, [])
  return createPortal(
    <button
      type="button"
      className={`rocket-top${show ? ' is-on' : ''}${launch ? ' is-launch' : ''}`}
      data-cursor="launch"
      onClick={(e) => {
        if (launch) return // already launching: no second rocket
        spray(e.currentTarget)
        e.currentTarget.blur() // it is about to be hidden; don't leave focus on a hidden button
        setShow(false) // the rocket has left: hide it now so the cursor lets go of it
        setLaunch(true)
        scrollToId('top', 0.9)
        launchTimer.current = setTimeout(() => setLaunch(false), 1300)
      }}
      aria-label="Back to top"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
    >
      <svg className="rocket-icon" viewBox="0 0 24 32" width="22" height="30" aria-hidden="true">
        <g className="rocket-flame">
          <path d="M9.6 21.5h4.8L12 31z" fill="#ff5a1f" />
          <path d="M10.6 21.5h2.8L12 27.5z" fill="#fff3b0" />
        </g>
        <path d="M7.6 12.5 3.6 18v3.6l4-1.9z M16.4 12.5l4 5.5v3.6l-4-1.9z" fill="#7c2d12" />
        <path d="M12 1.5c3 2.6 4.4 6 4.4 10v9.2H7.6V11.5c0-4 1.4-7.4 4.4-10z" fill="#fffdf8" stroke="#7c2d12" strokeWidth="1" strokeLinejoin="round" />
        <path d="M12 1.5c1.7 1.5 2.8 3.3 3.4 5.3H8.6c.6-2 1.7-3.8 3.4-5.3z" fill="#ea580c" />
        <circle cx="12" cy="11.2" r="2.3" fill="#38bdf8" stroke="#7c2d12" strokeWidth="1" />
        <rect x="7.6" y="18" width="8.8" height="2.7" fill="#ea580c" />
      </svg>
    </button>,
    document.body,
  )
}

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
      <RocketTop />
    </section>
  )
}
