// Prints what visitors asked Kairo (see server/questionLog.js).
//   npm run questions          the latest 50 and the most-asked questions
//   npm run questions -- 200   the latest 200
// Needs UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env (or the environment).
import { LOG_KEY } from '../server/questionLog.js'

try {
  process.loadEnvFile('.env')
} catch {
  /* no .env: use the environment as is */
}
const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env
if (!url || !token) {
  console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env first.')
  process.exit(1)
}

const count = Number(process.argv[2]) || 50
const res = await fetch(`${url}/lrange/${LOG_KEY}/0/${count - 1}`, { headers: { Authorization: `Bearer ${token}` } })
if (!res.ok) {
  console.error(`Upstash replied ${res.status}: ${await res.text()}`)
  process.exit(1)
}
const entries = (await res.json()).result.map((s) => JSON.parse(s))
if (!entries.length) {
  console.log('No questions logged yet.')
  process.exit(0)
}

console.log(`Latest ${entries.length} questions (newest first):\n`)
for (const e of entries) {
  const when = new Date(e.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  console.log(`${when.padEnd(22)} ${e.turn > 1 ? `#${e.turn}`.padEnd(4) : '    '} ${e.q}`)
}

const tally = new Map()
for (const e of entries) {
  const key = e.q.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()
  tally.set(key, (tally.get(key) || 0) + 1)
}
const top = [...tally].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10)
if (top.length) {
  console.log('\nAsked more than once:')
  for (const [q, n] of top) console.log(`  ${String(n).padStart(3)}×  ${q}`)
}
console.log('\n(#2, #3… = a follow-up question in the same conversation)')
