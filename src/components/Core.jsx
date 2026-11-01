import { useEffect, useRef } from 'react'
import { faceState } from '../chat/faceState.js'
import { coreStateName } from '../coreState.js'

// The AI-core orb (see coreScene.js): Kairo's avatar in the hero on laptops and desktops.
// Decorative only: hidden from assistive tech, never focusable. Kairo's click target and its
// keyboard button sit over it unchanged, so a click still rings the alarm and opens the colour
// picker. The hero mounts it only on wide screens with a capable GPU and loads this file lazily,
// so phones never download any of it. It pauses off screen and in hidden tabs.
export default function Core({ visible }) {
  const box = useRef(null)
  const core = useRef(null)
  const wantAssemble = useRef(false)

  // The hero's name has moved aside: the orb's pieces fly in and assemble.
  useEffect(() => {
    if (!visible) return
    wantAssemble.current = true
    core.current?.assemble()
  }, [visible])

  useEffect(() => {
    const el = box.current
    if (!el) return
    let dead = false
    let onScreen = true
    let tabShown = !document.hidden
    const sync = () => core.current?.setActive(onScreen && tabShown)

    // Build the scene when the browser is idle, so it doesn't delay the hero's first paint.
    const start = () => {
      if (dead) return
      import('../coreScene.js')
        .then(({ createCore }) => {
          if (dead) return
          core.current = createCore(el, () => coreStateName(faceState))
          if (wantAssemble.current) core.current.assemble()
          sync()
        })
        .catch(() => {})
    }
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 300)

    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      sync()
    })
    io.observe(el)
    const onVis = () => {
      tabShown = !document.hidden
      sync()
    }
    const onRing = () => core.current?.ring()
    const onTour = () => core.current?.tourStart()
    const onTourEnd = () => core.current?.tourEnd()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('tick-ring', onRing)
    window.addEventListener('kairo-tour', onTour)
    window.addEventListener('kairo-tour-end', onTourEnd)

    return () => {
      dead = true
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle)
      else clearTimeout(idle)
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('tick-ring', onRing)
      window.removeEventListener('kairo-tour', onTour)
      window.removeEventListener('kairo-tour-end', onTourEnd)
      core.current?.dispose()
      core.current = null
    }
  }, [])

  return <div ref={box} className="core-orb" aria-hidden="true" />
}
