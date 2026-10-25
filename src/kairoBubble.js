// Speech-bubble rules for Kairo: which lines show, and when.
export const HELLO_KEY = 'kairo-hello'
export const HELLO_TEXT = "Hi, I'm Kairo. Ask me anything about Tarun."

// The first-visit hello: only if it was never shown, or when `?hello` is in the URL (to replay it).
export function helloWanted(search, seen) {
  if (new URLSearchParams(search).has('hello')) return true
  return !seen
}

// Lines for the hero elements Kairo reacts to (tagged data-kairo in Hero.jsx and Chat.jsx).
export const CUES = {
  work: 'Projects are just below',
  tour: "I'll show you around",
  chat: "Go ahead, I'm listening",
}

// The line for a cue, or null once it has been shown this visit (`shown` is a Set of ids).
export function cueText(id, shown) {
  return CUES[id] && !shown.has(id) ? CUES[id] : null
}
