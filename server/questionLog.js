// Log of what visitors ask Kairo, kept in Upstash Redis so Tarun can see which questions come up
// and improve data.js. Only the question text (emails, links and phone numbers removed), its turn
// in the conversation and the time are stored: no IP, no answer. The newest MAX_KEPT are kept.
// Off unless UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set; read it with
// `npm run questions`.
export const LOG_KEY = 'kairo:questions'
const MAX_KEPT = 2000

export const isLogging = (env) => Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

// Visitors sometimes type their own contact details. The saved copy has emails, links and phone
// numbers replaced; Groq still gets the original question. Names and addresses written in plain
// words can't be spotted reliably, so they are not covered.
const DATE_OR_YEAR_RANGE = /^(\d{4}\s*-\s*\d{4}|\d{4}-\d{2}-\d{2})$/
export function maskContact(text) {
  return text
    .replace(/[\w.+-]{1,64}@[\w-]{1,63}(\.[\w-]{1,63}){1,5}/g, '[email]')
    .replace(/\b(https?:\/\/|www\.)\S+/gi, '[link]')
    .replace(/[+(]?\d[\d\s().-]{6,}\d/g, (m) =>
      m.replace(/\D/g, '').length >= 8 && !DATE_OR_YEAR_RANGE.test(m.replace(/^\(/, '')) ? '[phone]' : m,
    )
}

// Never throws: a logging problem must not break the chat.
export async function logQuestion(question, turn, env) {
  if (!isLogging(env)) return
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  const entry = JSON.stringify({ q: maskContact(question), turn, at: new Date().toISOString() })
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
