import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { animate, stagger } from 'animejs'
import { currentJob, profile } from '../data.js'
import { useReducedMotion } from '../hooks.js'
import Chat from '../chat/Chat.jsx'
import { LIGHT } from '../orb/orbTheme.js'
import KairoOrb from './KairoOrb.jsx'
import Mascot from './Mascot.jsx'
import TourParticles from './TourParticles.jsx'

// Three.js loads after the text has painted, so recruiters see content first.
const ParticleScene = lazy(() => import('./ParticleScene.jsx'))

function hasWebGL() {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

// Phones and low-power devices skip the particle scene (seconds of main-thread work on a
// mid-range phone) and start straight on the solid name, Kairo and the chat.
function canRunParticles() {
  const nav = navigator
  if (window.matchMedia('(max-width: 640px)').matches) return false
  if (nav.connection?.saveData) return false
  if (nav.deviceMemory && nav.deviceMemory < 4) return false
  if (nav.hardwareConcurrency && nav.hardwareConcurrency < 4) return false
  return hasWebGL()
}

function useWide() {
  const query = '(min-width: 900px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

// Particles trace the real typeface, so wait (briefly) for Geist.
function useFontsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    const load = document.fonts?.load ? document.fonts.load('600 100px Geist') : Promise.resolve()
    Promise.race([load, new Promise((r) => setTimeout(r, 1500))])
      .catch(() => {})
      .then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [])
  return ready
}

function SplitText({ text }) {
  return (
    <span>
      {/* The letters below are split into spans for the animation, so a screen reader gets the
          whole text from here instead. */}
      <span className="sr-only">{text}</span>
      {text.split(' ').map((word, w) => (
        <span className="word" aria-hidden="true" key={w}>
          {[...word].map((ch, i) => (
            <span className="char" key={i}>
              {ch}
            </span>
          ))}
        </span>
      ))}
    </span>
  )
}

// The hero's golden orb, where Kairo stands (75% across, 32% down), about 0.475 of the hero's height
// wide so its rim matches the click target in Mascot.jsx. The size moves in 20px steps so a window
// resize does not rebuild the canvas every frame. It fades out while the tour shows the clock.
function HeroOrb({ visible, heroRef, onFail }) {
  const [size, setSize] = useState(300)
  const [touring, setTouring] = useState(false)
  // For the first few seconds after the reveal the orb has no fade (its pieces build it).
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(() => setIntro(false), 4000)
    return () => clearTimeout(t)
  }, [visible])
  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const measure = () => setSize(Math.max(200, Math.round((el.clientHeight * 0.475) / 20) * 20))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const on = () => setTouring(true)
    const off = () => setTouring(false)
    window.addEventListener('kairo-tour', on)
    window.addEventListener('kairo-tour-end', off)
    return () => {
      ro.disconnect()
      window.removeEventListener('kairo-tour', on)
      window.removeEventListener('kairo-tour-end', off)
    }
  }, [heroRef])
  const tail = Math.round(size * 0.75)
  // The orb lights the hero behind it and the top of the chat panel, in its inner colour. The
  // strength goes straight to the two elements' opacity each frame (cheap); the tint is rewritten
  // only when the colour has moved.
  const lightEl = useRef(null)
  const tint = useRef('')
  const onLight = useCallback(
    (strength, inner) => {
      const glow = lightEl.current
      if (!glow) return
      const on = visible && !touring
      glow.style.opacity = on ? strength : 0
      const chat = heroRef.current?.querySelector('.chat-light')
      if (chat) chat.style.opacity = on ? strength * LIGHT.chat : 0
      const step = LIGHT.colourStep
      const key = inner.map((x) => Math.round(x / step)).join(',')
      if (key === tint.current) return
      tint.current = key
      const rgb = inner.map((x) => Math.round(x)).join(',')
      glow.style.background = `radial-gradient(closest-side, rgba(${rgb},0.3), rgba(${rgb},0.1) 45%, rgba(${rgb},0) 100%)`
      if (chat) chat.style.background = `linear-gradient(to bottom, rgba(${rgb},0.3), rgba(${rgb},0) 45%)`
    },
    [visible, touring, heroRef],
  )
  return (
    <>
      <div ref={lightEl} className="kairo-orb-light" aria-hidden="true" />
      {/* The canvas has extra room below the orb for its pieces to drift into as the page scrolls; the
          wrapper is nudged down by half of it so the orb itself stays where it was. */}
      <div
        className={`kairo-orb-hero${visible && !touring ? ' is-visible' : ''}${intro ? ' is-intro' : ''}`}
        style={{ marginTop: tail / 2 }}
        aria-hidden="true"
      >
        <KairoOrb size={size} tail={tail} scrollApart onFail={onFail} onLight={onLight} />
      </div>
    </>
  )
}

export default function Hero({ onTour }) {
  const ref = useRef(null)
  const nameRef = useRef(null)
  const [particles] = useState(canRunParticles)
  const reduce = useReducedMotion()
  const wide = useWide()
  const fontsReady = useFontsReady()
  // Wide screens with motion get the golden canvas orb as Kairo's hero avatar; phones, narrow
  // windows and reduced motion keep Kairo's own drawing.
  // If the canvas cannot draw, Kairo's own drawing comes back.
  const [orbFailed, setOrbFailed] = useState(false)
  const onOrbFail = useCallback(() => setOrbFailed(true), [])
  const orbOn = wide && !reduce && !orbFailed
  // Phase 1: the name forms. Phase 2 ("split"): name moves aside, face + chat appear.
  const [split, setSplit] = useState(() => reduce || !particles)
  // Phase 3 ("resolved"): the particles hand over to the crisp, solid name.
  const [resolved, setResolved] = useState(() => reduce || !particles)
  // The pause between the golden sweep and moving the name aside; cleared if the hero goes away first.
  const splitTimer = useRef()
  useEffect(() => () => clearTimeout(splitTimer.current), [])

  // Normally the particle scene resolves the name after its white sweep (onSwept);
  // this is only a safety net in case frames stall.
  useEffect(() => {
    if (!split || resolved) return
    const t = setTimeout(() => setResolved(true), 6000)
    return () => clearTimeout(t)
  }, [split, resolved])

  // Safety net: never leave visitors waiting if WebGL is slow to start.
  useEffect(() => {
    const t = setTimeout(() => setSplit(true), 7000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (reduce) return
    const a = animate(ref.current.querySelectorAll('.hud'), {
      opacity: [0, 1],
      translateY: [-8, 0],
      delay: stagger(120, { start: 300 }),
      duration: 900,
      ease: 'outExpo',
    })
    return () => a.revert()
  }, [reduce])

  useEffect(() => {
    if (!split || reduce) return
    const q = (s) => ref.current.querySelectorAll(s)
    const anims = [
      animate(q('.hero-role .char'), { opacity: [0, 1], translateY: ['0.5em', 0], delay: stagger(35, { start: 900 }), duration: 700, ease: 'outExpo' }),
      animate(q('.hero-quote .char'), { opacity: [0, 1], delay: stagger(10, { start: 1300 }), duration: 300, ease: 'linear' }),
      animate(q('.reveal'), { opacity: [0, 1], translateY: [12, 0], delay: stagger(140, { start: 1700 }), duration: 900, ease: 'outExpo' }),
    ]
    return () => anims.forEach((a) => a.revert())
  }, [split, reduce])

  return (
    <section id="top" ref={ref} className={`hero${reduce ? '' : ' intro'}${split ? ' is-split' : ''}`} aria-labelledby="hero-title">
      <div className="hero-canvas" aria-hidden="true">
        {particles && fontsReady ? (
          <Suspense fallback={null}>
            <ParticleScene
              active
              split={split}
              resolved={resolved}
              nameAnchor={nameRef}
              reduce={reduce}
              wide={wide}
              // Move aside as soon as the golden sweep (2.4s) has crossed the name.
              onFormed={() => {
                splitTimer.current = setTimeout(() => setSplit(true), 2400)
              }}
              onSwept={() => setResolved(true)}
            />
          </Suspense>
        ) : null}
      </div>

      <div className="hud hud-left mono">
        <p>
          <span className="amber">EXP 00</span> <span className="dim">//</span> ORIGIN
        </p>
        <p className="small status">
          {currentJob ? currentJob.org.replace(/ Pvt\. Ltd$/, '') : profile.role} · LLM apps
        </p>
      </div>

      <h1 id="hero-title" className="sr-only">
        {profile.name}, {profile.role}
      </h1>

      <div className="hero-left">
        {/* Crisp name; the particle name lands exactly on this element, then dissolves.
            On hover, a spotlight around the cursor opens it back up into particles. */}
        <p ref={nameRef} className={`hero-name${resolved ? ' is-resolved' : ''}`} aria-hidden="true">
          {profile.name
            .toUpperCase()
            .split(' ')
            .map((w) => (
              <span key={w}>{w}</span>
            ))}
        </p>
        <p className="hero-role">
          <SplitText text={profile.role.toUpperCase()} />
        </p>
        <p className="hero-quote mono">
          <SplitText text={`“${profile.tagline}”`} />
        </p>
        <div className="hero-links reveal">
          <a href="#experiments" className="scroll-cue mono" data-kairo="work" data-cursor="work">
            <span className="glyph" aria-hidden="true">
              ∇
            </span>
            See my work <span aria-hidden="true">↓</span>
          </a>
          <button type="button" className="tour-link mono" data-kairo="tour" data-cursor="tour" onClick={onTour}>
            <span aria-hidden="true">▶</span> Take the 60-second tour
          </button>
        </div>
      </div>

      {orbOn ? <HeroOrb visible={split} heroRef={ref} onFail={onOrbFail} /> : null}
      {orbOn ? <TourParticles /> : null}
      <Mascot visible={split} hideArt={orbOn} />

      <div className="hero-right">
        <Chat visible={split} />
      </div>
    </section>
  )
}
