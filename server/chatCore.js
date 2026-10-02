// Shared by the Vercel function (api/chat.js) and the Vite dev server.
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

// Returns { status, body } so both runtimes can send it however they like.
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
        messages: [{ role: 'system', content: SYSTEM }, ...history],
      }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return { status: 502, body: { error: 'upstream', code: res.status } }
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content?.trim()
    if (!text) return { status: 502, body: { error: 'empty' } }
    return { status: 200, body: { text: text.replace(/\*\*/g, '') } }
  } catch {
    return { status: 502, body: { error: 'network' } }
  }
}
