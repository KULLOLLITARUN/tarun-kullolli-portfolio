// Shared by the Vercel function (api/chat.js) and the Vite dev server.
// The answer streams back as plain text while Groq generates it.
// Validates input, rate-limits per IP and asks Groq. The API key stays server-side.
import { buildSystemPrompt } from '../src/chat/prompt.js'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const SYSTEM = buildSystemPrompt()
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 25
const hitsByIp = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hitsByIp.set(ip, recent)
  if (hitsByIp.size > 5000) hitsByIp.clear() // keep memory bounded
  return recent.length > MAX_PER_WINDOW
}

function cleanHistory(messages) {
  if (!Array.isArray(messages)) return null
  const out = messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.slice(0, m.role === 'user' ? 300 : 800) }))
  return out.length && out.at(-1).role === 'user' ? out : null
}

// Groq's server-sent events → the answer text, piece by piece.
async function* textChunks(res) {
  const decoder = new TextDecoder()
  let buffer = ''
  for await (const bytes of res.body) {
    buffer += decoder.decode(bytes, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue
      try {
        const piece = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content
        if (piece) yield piece
      } catch {
        /* skip a malformed event */
      }
    }
  }
}

// Returns { status, body } for errors, or { status: 200, stream } (async iterable of text)
// on success, so both runtimes can send it however they like.
export async function handleChat({ body, ip, env }) {
  const apiKey = env.GROQ_API_KEY
  if (!apiKey) return { status: 503, body: { error: 'not_configured' } }
  if (rateLimited(ip || 'unknown')) return { status: 429, body: { error: 'rate_limited' } }

  const history = cleanHistory(body?.messages)
  if (!history) return { status: 400, body: { error: 'bad_request' } }

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
        temperature: 0.3,
        // gpt-oss reasons before answering: keep it brief and leave room for both.
        reasoning_effort: 'low',
        include_reasoning: false,
        max_tokens: 700,
        stream: true,
        messages: [{ role: 'system', content: SYSTEM }, ...history],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { status: 502, body: { error: 'upstream', code: res.status } }
    return { status: 200, stream: textChunks(res) }
  } catch {
    return { status: 502, body: { error: 'network' } }
  }
}

// Writes handleChat's result to a Node response: JSON for errors, streamed text otherwise.
// If Groq fails mid-answer the text simply ends early; the client keeps what arrived.
export async function sendChat(res, out) {
  if (!out.stream) {
    res.statusCode = out.status
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify(out.body))
  }
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  try {
    for await (const piece of out.stream) res.write(piece)
  } catch {
    /* timeout or dropped connection */
  }
  res.end()
}
