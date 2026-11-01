// Limits for the chat: per visitor, and a daily cap on all questions together (so one script can't
// use up the Groq quota). Counted in Upstash Redis when it is configured, so every serverless
// instance shares the numbers; otherwise (or if Upstash fails) a per-instance in-memory count is
// used, which is the old behaviour. A limiter problem must never break the chat.
//
// The visitor's IP is stored only as a hash inside a key that expires with its window, and it is
// never written next to a question.
import { createHash } from 'node:crypto'

export const WINDOW_MS = 10 * 60 * 1000
export const MAX_PER_WINDOW = 25
export const DEFAULT_DAILY_CAP = 1000 // placeholder: set GROQ_DAILY_CAP to ~80% of Groq's real limit

const hitsByIp = new Map()

// Per-instance fallback.
export function memoryLimited(ip) {
  const now = Date.now()
  const recent = (hitsByIp.get(ip) || []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hitsByIp.set(ip, recent)
  if (hitsByIp.size > 5000) hitsByIp.clear() // keep memory bounded
  return recent.length > MAX_PER_WINDOW
}

export const dailyCap = (env) => {
  const n = Number(env.GROQ_DAILY_CAP)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_DAILY_CAP
}

const secondsUntilUtcMidnight = (now) => {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000))
}

// INCR + EXPIRE for each key in one round trip; returns the new counts, or null on any failure.
async function count(env, keys) {
  const commands = keys.flatMap(({ key, ttl }) => [
    ['INCR', key],
    ['EXPIRE', key, String(ttl)],
  ])
  try {
    const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return null
    const rows = await res.json()
    const counts = keys.map((_, i) => rows?.[i * 2]?.result)
    return counts.every((n) => Number.isInteger(n)) ? counts : null
  } catch {
    return null
  }
}

// Returns null when the question may go ahead, or what stopped it:
//   { reason: 'ip' }                       this visitor asked too much
//   { reason: 'daily', retryAfter }        the whole site is at its daily cap
export async function checkLimits(ip, env, now = new Date()) {
  const shared = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
  if (!shared) return memoryLimited(ip) ? { reason: 'ip' } : null

  const windowIndex = Math.floor(now.getTime() / WINDOW_MS)
  const hash = createHash('sha256').update(`${ip}|${windowIndex}`).digest('hex').slice(0, 32)
  const visitor = await count(env, [{ key: `kairo:rl:${hash}`, ttl: Math.ceil(WINDOW_MS / 1000) }])
  if (!visitor) return memoryLimited(ip) ? { reason: 'ip' } : null // Upstash down: old behaviour
  if (visitor[0] > MAX_PER_WINDOW) return { reason: 'ip' }

  // Only questions that pass the visitor check use up the daily allowance.
  const day = now.toISOString().slice(0, 10)
  const total = await count(env, [{ key: `kairo:day:${day}`, ttl: 2 * 24 * 3600 }])
  if (total && total[0] > dailyCap(env)) return { reason: 'daily', retryAfter: secondsUntilUtcMidnight(now) }
  return null
}
