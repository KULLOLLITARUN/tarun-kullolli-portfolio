import { useEffect, useRef, useState } from 'react'
import { answer, GREETING, STARTER_CHIPS } from './engine.js'
import { faceState, noteAnswer } from './faceState.js'

// The live model starts off-topic replies with this tag (see prompt.js); it is never shown.
const OFF_TOPIC = /^\s*\[off-topic\]\s*/i
// Used if the model sends the tag with nothing after it.
const OFF_TOPIC_REPLY = 'That’s outside what I can help with. Ask me about Tarun’s experience, projects or skills.'
import { useReducedMotion } from '../hooks.js'

let nextId = 1

// Live answer from Groq via /api/chat, streamed: onText gets the text so far as it arrives.
// Resolves to the full text, or null if nothing arrived so the offline engine takes over.
async function askLive(history, onText) {
  let text = ''
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok || !res.body) return null
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      text += value
      onText(text)
    }
  } catch {
    /* keep whatever arrived */
  }
  return text.trim() ? text : null
}

function Message({ m }) {
  const text = m.shown ?? m.text
  return (
    <li className={`msg msg-${m.from}`}>
      {m.from === 'bot' && (
        <span className="msg-who mono" aria-hidden="true">
          KAIRO
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
  const askRef = useRef(null)
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
    const offline = answer(q)
    const started = Date.now()
    const id = nextId++
    let streamed = '' // live text received so far
    let live = true // false once the live model has failed: the offline answer is used
    let ended = false
    let typing = false

    // The text to type out right now. The off-topic tag and markdown bold are never shown.
    const target = () => {
      if (!live) return offline.text
      const t = streamed.replace(OFF_TOPIC, '').replace(/\*\*/g, '')
      return ended ? t.trim() || OFF_TOPIC_REPLY : t.trimStart().replace(/\*$/, '')
    }

    // Type the answer out while the face "speaks", keeping pace with the stream;
    // screen readers get the full text once at the end.
    const startTyping = () => {
      if (typing) return
      typing = true
      later(() => {
        faceState.thinking = false
        faceState.talking = true
        // Off-topic: the live model's tag when it answered, otherwise the offline engine's miss.
        noteAnswer(live ? OFF_TOPIC.test(streamed) : !!offline.miss)
        setMode(live ? 'live' : 'offline')
        setMessages((ms) => [...ms, { id, from: 'bot', text: '', shown: '' }])
        let i = 0
        let last = ''
        const step = () => {
          const full = target()
          i = reduce ? full.length : Math.min(full.length, i + 3)
          const shown = full.slice(0, i)
          if (shown !== last) {
            last = shown
            setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, text: full, shown } : m)))
          }
          if (!ended || i < full.length) return later(step, 16)
          setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, text: full, actions: offline.actions, shown: undefined } : m)))
          faceState.talking = false
          setBusy(false)
          setChips(offline.followUps || [])
          setAnnounce(full)
        }
        step()
      }, Math.max(0, 600 - (Date.now() - started)))
    }

    const result = await askLive(history, (text) => {
      streamed = text
      // Wait for enough text to know whether it starts with the off-topic tag.
      if (text.trimStart().length >= 12) startTyping()
    })
    live = result !== null
    if (live) streamed = result
    ended = true
    startTyping()
  }
  askRef.current = { ask, busy }

  // "Ask Kairo about this project" buttons elsewhere on the page.
  useEffect(() => {
    const onAsk = (e) => {
      const { ask, busy } = askRef.current
      if (busy) setInput(e.detail)
      else ask(e.detail)
    }
    window.addEventListener('ask-kairo', onAsk)
    return () => window.removeEventListener('ask-kairo', onAsk)
  }, [])

  return (
    <section className={`chat${visible ? ' is-visible' : ''}`} aria-label="Resume assistant" inert={!visible}>
      <header className="chat-head mono">
        <span>
          <span className="pulse" aria-hidden="true" /> KAIRO <span className="dim">{'// Assistant'}</span>
        </span>
        <span className="dim small">{mode === 'offline' ? 'Offline mode' : 'Ask about my resume'}</span>
      </header>

      <ol className="chat-log" ref={log} data-lenis-prevent>
        {messages.map((m) => (
          <Message key={m.id} m={m} />
        ))}
        {busy && messages.at(-1)?.from === 'user' && (
          <li className="msg msg-bot typing" aria-hidden="true">
            <span className="msg-who mono">KAIRO</span>
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
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about Tarun’s experience…"
          maxLength={200}
          autoComplete="off"
          aria-describedby="chat-note"
        />
        <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Send question">
          ↑
        </button>
      </form>
      {/* Questions are logged anonymously (server/questionLog.js); say so plainly. */}
      <p id="chat-note" className="chat-note">
        Questions are saved anonymously to improve Kairo’s answers.
      </p>
    </section>
  )
}
