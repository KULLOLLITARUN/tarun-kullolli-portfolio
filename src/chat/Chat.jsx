import { useEffect, useRef, useState } from 'react'
import { answer, GREETING, STARTER_CHIPS } from './engine.js'
import { faceState, noteAnswer } from './faceState.js'

// The live model starts off-topic replies with this tag (see prompt.js); it is never shown.
const OFF_TOPIC = /^\s*\[off-topic\]\s*/i
// Used if the model sends the tag with nothing after it.
const OFF_TOPIC_REPLY = 'That’s outside what I can help with. Ask me about Tarun’s experience, projects or skills.'
import { useReducedMotion } from '../hooks.js'

let nextId = 1

// Live answer from Groq via /api/chat; null on any failure so the offline engine takes over.
async function askLive(history) {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.text === 'string' && data.text ? data.text : null
  } catch {
    return null
  }
}

function Message({ m }) {
  const text = m.shown ?? m.text
  return (
    <li className={`msg msg-${m.from}`}>
      {m.from === 'bot' && (
        <span className="msg-who mono" aria-hidden="true">
          TK-01
        </span>
      )}
      <div className="msg-text">
        {text.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {m.actions && m.shown === undefined && (
          <p className="msg-actions">
            {m.actions.map((a) => (
              <a key={a.label} href={a.href} {...(a.download ? { download: 'Tarun-Kullolli-Resume.pdf' } : {})}
                {...(a.external ? { target: '_blank', rel: 'noreferrer' } : {})}>
                {a.label} <span aria-hidden="true">→</span>
              </a>
            ))}
          </p>
        )}
      </div>
    </li>
  )
}

export default function Chat({ visible }) {
  const [messages, setMessages] = useState([{ id: 0, from: 'bot', text: GREETING }])
  const [chips, setChips] = useState(STARTER_CHIPS)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [mode, setMode] = useState(null) // 'live' | 'offline' after the first answer
  const log = useRef(null)
  const timers = useRef([])
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = log.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      faceState.thinking = false
      faceState.talking = false
    },
    [],
  )

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

  // Ringing Tick's alarm: once it stops, offer a question in the input (focused, except on
  // touch screens, where focusing would pop the keyboard up).
  const inputRef = useRef(null)
  const offer = useRef(() => {})
  offer.current = () => {
    if (busy || input.trim() || !visible) return
    const pool = chips.length ? chips : STARTER_CHIPS
    setInput(pool[Math.floor(Math.random() * pool.length)])
    if (!window.matchMedia('(pointer: coarse)').matches) inputRef.current?.focus({ preventScroll: true })
  }
  useEffect(() => {
    const onRing = () => later(() => offer.current(), 900)
    window.addEventListener('tick-ring', onRing)
    return () => window.removeEventListener('tick-ring', onRing)
  }, [])

  async function ask(raw) {
    const q = raw.trim().slice(0, 200)
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setChips([])
    setMessages((ms) => [...ms, { id: nextId++, from: 'user', text: q }])
    faceState.thinking = true

    // The offline engine always runs: it supplies follow-up chips and action links,
    // and its text is used whenever the live model is unavailable.
    const history = [...messages, { from: 'user', text: q }].map((m) => ({
      role: m.from === 'user' ? 'user' : 'assistant',
      content: m.text,
    }))
    const started = Date.now()
    const live = await askLive(history)
    const offline = answer(q)
    // Off-topic: the live model's tag when it answered, otherwise the offline engine's miss.
    const offTopic = live ? OFF_TOPIC.test(live) : !!offline.miss
    const liveText = live?.replace(OFF_TOPIC, '').trim() || (live && OFF_TOPIC_REPLY)
    const reply = live ? { ...offline, text: liveText } : offline
    setMode(live ? 'live' : 'offline')
    const id = nextId++
    later(() => {
      faceState.thinking = false
      faceState.talking = true
      noteAnswer(offTopic)
      // Type the answer out while the face "speaks"; screen readers get the full text once.
      setMessages((ms) => [...ms, { id, from: 'bot', text: reply.text, actions: reply.actions, shown: reduce ? undefined : '' }])
      const finish = () => {
        setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, shown: undefined } : m)))
        faceState.talking = false
        setBusy(false)
        setChips(reply.followUps || [])
        setAnnounce(reply.text)
      }
      if (reduce) return finish()
      let i = 0
      const step = () => {
        i = Math.min(reply.text.length, i + 3)
        setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, shown: reply.text.slice(0, i) } : m)))
        if (i < reply.text.length) later(step, 16)
        else finish()
      }
      step()
    }, Math.max(0, 600 - (Date.now() - started)))
  }

  return (
    <section className={`chat${visible ? ' is-visible' : ''}`} aria-label="Resume assistant" inert={!visible}>
      <header className="chat-head mono">
        <span>
          <span className="pulse" aria-hidden="true" /> TK-01 <span className="dim">{'// Assistant'}</span>
        </span>
        <span className="dim small">{mode === 'offline' ? 'Offline mode' : 'Ask about my resume'}</span>
      </header>

      <ol className="chat-log" ref={log} data-lenis-prevent>
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && messages.at(-1)?.from === 'user' && (
          <li className="msg msg-bot typing" aria-hidden="true">
            <span className="msg-who mono">TK-01</span>
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          </li>
        )}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      {chips.length > 0 && (
        <ul className="chat-chips" aria-label="Suggested questions">
          {chips.map((c) => (
            <li key={c}>
              <button type="button" onClick={() => ask(c)} disabled={busy}>
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="chat-form"
        onSubmit={(e) => {
          e.preventDefault()
          ask(input)
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask about Tarun’s resume
        </label>
        <input
          id="chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Tarun’s experience…"
          maxLength={200}
          autoComplete="off"
        />
        <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Send question">
          ↑
        </button>
      </form>
    </section>
  )
}
