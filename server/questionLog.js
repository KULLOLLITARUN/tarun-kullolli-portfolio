// Anonymous log of what visitors ask Kairo, kept in Upstash Redis so Tarun can see which
// questions come up and improve data.js. Only the question text, its turn in the conversation
// and the time are stored: no IP, no answer, nothing identifying. The newest MAX_KEPT are kept.
// Off unless UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set; read it with
// `npm run questions`.
export const LOG_KEY = 'kairo:questions'
const MAX_KEPT = 2000

export const isLogging = (env) => Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

// Never throws: a logging problem must not break the chat.
export async function logQuestion(question, turn, env) {
  if (!isLogging(env)) return
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  const entry = JSON.stringify({ q: question, turn, at: new Date().toISOString() })
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([
        ['LPUSH', LOG_KEY, entry],
        ['LTRIM', LOG_KEY, '0', String(MAX_KEPT - 1)],
      ]),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    /* ignore */
  }
}
