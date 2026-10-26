// Remembers when the live model (Groq) failed, so the chat goes straight to the offline answer
// instead of waiting on a model that is down or out of quota. After the cooldown it tries again.
export const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000
const MIN_COOLDOWN_MS = 30 * 1000
const MAX_COOLDOWN_MS = 60 * 60 * 1000

export function createLiveGate(now = () => Date.now()) {
  let until = 0
  return {
    canTry: () => now() >= until,
    // retryAfterSec: the provider's own "try again in N seconds", when it said so.
    fail(retryAfterSec) {
      const wanted = retryAfterSec > 0 ? retryAfterSec * 1000 : DEFAULT_COOLDOWN_MS
      until = now() + Math.min(MAX_COOLDOWN_MS, Math.max(MIN_COOLDOWN_MS, wanted))
    },
    ok() {
      until = 0
    },
  }
}
