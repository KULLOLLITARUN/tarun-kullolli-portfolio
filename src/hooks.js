import { useEffect, useState } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'

// Boolean flag persisted in localStorage (storage failures are ignored).
export function useStoredFlag(key, initial) {
  const [value, setValue] = useState(() => {
    if (initial !== undefined) return initial
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, value ? '1' : '0')
    } catch {
      /* private mode etc. */
    }
  }, [key, value])
  return [value, setValue]
}

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduce, setReduce] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setReduce(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduce
}

const NAV_OFFSET = -72
let lenis = null

// Lenis smooth scrolling; off when the user prefers reduced motion.
export function useSmoothScroll(enabled) {
  useEffect(() => {
    if (!enabled) return
    lenis = new Lenis({ autoRaf: true, lerp: 0.09, anchors: { offset: NAV_OFFSET } })
    return () => {
      lenis.destroy()
      lenis = null
    }
  }, [enabled])
}

// Scroll positions (px) at which each section's particle station has fully formed, keyed by
// section id. Written every frame by the particle scene; empty without it.
export const stationDone = {}

export function scrollToId(id) {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: id === 'top' ? 0 : NAV_OFFSET, duration: 1.4 })
  else el.scrollIntoView({ block: 'start' })
}

// Like scrollToId, but goes on far enough for the section's particles to finish forming it
// (used by the tour, which then holds still on each section).
export function scrollToStation(id) {
  const el = document.getElementById(id)
  const done = stationDone[id]
  if (!el || done === undefined || !lenis) return scrollToId(id)
  const top = el.getBoundingClientRect().top + window.scrollY + NAV_OFFSET
  lenis.scrollTo(Math.max(top, Math.ceil(done) + 2), { duration: 1.4 })
}
