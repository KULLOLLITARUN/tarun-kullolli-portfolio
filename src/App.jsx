import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { profile } from './data.js'
import { scrollToId, useReducedMotion, useSmoothScroll, useStoredFlag } from './hooks.js'
import Nav from './components/Nav.jsx'
import Hero from './components/Hero.jsx'
import Experiments from './components/Experiments.jsx'
import Acts from './components/Acts.jsx'
import SystemIndex from './components/SystemIndex.jsx'
import Contact from './components/Contact.jsx'
import RecruiterView from './components/RecruiterView.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import Tour from './components/Tour.jsx'
import Cursor from './components/Cursor.jsx'

const forceRecruiter = new URLSearchParams(window.location.search).has('recruiter') ? true : undefined

export default function App() {
  const [recruiter, setRecruiter] = useStoredFlag('recruiter-mode', forceRecruiter)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [touring, setTouring] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef()
  useSmoothScroll(!useReducedMotion())

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const notify = useCallback((msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2400)
  }, [])

  const copyEmail = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      notify('Email copied to clipboard')
    } catch {
      notify(profile.email)
    }
  }, [notify])

  // Sections only exist in lab view, so leave recruiter mode before scrolling.
  const goTo = useCallback(
    (id) => {
      setRecruiter(false)
      setTimeout(() => scrollToId(id), 60)
    },
    [setRecruiter],
  )

  const startTour = useCallback(() => {
    setRecruiter(false)
    setTouring(true)
  }, [setRecruiter])

  const actions = useMemo(
    () => [
      { id: 'experiments', label: 'Go to Experiments', hint: 'Projects', run: () => goTo('experiments') },
      { id: 'acts', label: 'Go to Acts', hint: 'Experience', run: () => goTo('acts') },
      { id: 'system', label: 'Go to System Index', hint: 'Skills', run: () => goTo('system') },
      { id: 'contact', label: 'Go to Contact', hint: 'Reach out', run: () => goTo('contact') },
      { id: 'resume', label: 'Download resume', hint: 'PDF', run: () => window.open(profile.resume, '_blank') },
      { id: 'email', label: 'Copy email address', hint: profile.email, run: copyEmail },
      { id: 'tour', label: 'Start auto tour', hint: '60 seconds', run: startTour },
      {
        id: 'mode',
        label: recruiter ? 'Switch to lab view' : 'Switch to recruiter mode',
        hint: 'View',
        run: () => setRecruiter((r) => !r),
      },
    ],
    [goTo, copyEmail, startTour, recruiter, setRecruiter],
  )

  return (
    <>
      <Cursor />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav
        recruiter={recruiter}
        onToggleRecruiter={() => setRecruiter((r) => !r)}
        onPalette={() => setPaletteOpen(true)}
      />
      <main id="main">
        {recruiter ? (
          <RecruiterView onCopyEmail={copyEmail} />
        ) : (
          <>
            <Hero onTour={startTour} />
            <Experiments />
            <Acts />
            <SystemIndex />
            <Contact onCopyEmail={copyEmail} />
          </>
        )}
      </main>
      <footer className="footer">
        <span>© 2026 {profile.name}</span>
        <span className="mono">BUILT WITH REACT · THREE.JS · GLSL</span>
      </footer>

      {touring && !recruiter && <Tour onEnd={() => setTouring(false)} />}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} actions={actions} />
      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
    </>
  )
}
