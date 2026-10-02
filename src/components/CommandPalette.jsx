import { useEffect, useMemo, useRef, useState } from 'react'

export default function CommandPalette({ open, onClose, actions }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef(null)
  const returnFocus = useRef(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? actions.filter((a) => `${a.label} ${a.hint}`.toLowerCase().includes(q)) : actions
  }, [query, actions])

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement
    setQuery('')
    setActive(0)
    requestAnimationFrame(() => input.current?.focus())
    return () => returnFocus.current?.focus?.()
  }, [open])

  if (!open) return null

  const run = (a) => {
    onClose()
    a.run()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault()
      run(results[active])
    } else if (e.key === 'Tab') {
      e.preventDefault() // keep focus inside the dialog
    }
  }

  return (
    <div className="palette-backdrop" onMouseDown={onClose}>
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <input
          ref={input}
          className="palette-input"
          placeholder="Type a command or search…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
          aria-label="Search commands"
        />
        <ul id="palette-list" role="listbox" className="palette-list">
          {results.length === 0 && <li className="palette-empty">No matching commands</li>}
          {results.map((a, i) => (
            <li
              key={a.id}
              id={`cmd-${a.id}`}
              role="option"
              aria-selected={i === active}
              className="palette-item"
              onMouseMove={() => setActive(i)}
              onClick={() => run(a)}
            >
              <span>{a.label}</span>
              <span className="mono dim">{a.hint}</span>
            </li>
          ))}
        </ul>
        <p className="palette-foot mono dim">↑↓ navigate · Enter select · Esc close</p>
      </div>
    </div>
  )
}
