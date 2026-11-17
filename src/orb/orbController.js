import { faceState } from '../chat/faceState.js'
import { orbStateName } from '../kairoOrb.js'
import { BUMP, CONTRACT, EASE, FLASH, INNER, PRESETS, THINK, TYPING, WAKE } from './orbTheme.js'

// One shared controller for both orbs (the hero orb and the header avatar), a module-level object
// like faceState: no React state, no re-renders. It owns the clock (`t`), the rotation (`yaw`), the
// eased state values and every event animation, so the two orbs animate from the same time and the
// same event timestamps. Each orb keeps its own requestAnimationFrame loop and calls tick(now);
// the first call in a frame advances everything, the second just reads the same values.
//
// The chat only calls the hooks at the bottom (wake, type, contract, flash, bump, pulse). It never
// touches a renderer. The idle / thinking / speaking state still comes from faceState.

const TAU = Math.PI * 2
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
const rnd = (a, b) => a + Math.random() * (b - a)
const randUnit = () => {
  const u = rnd(-1, 1)
  const a = rnd(0, TAU)
  const s = Math.sqrt(1 - u * u)
  return [s * Math.cos(a), u, s * Math.sin(a)]
}
const clamp01 = (x) => Math.max(0, Math.min(1, x))

export const orbController = {
  // ---- the clock and the eased state values (read by the renderers) --------------------
  t: 0, // shared seconds, advanced once per frame
  dt: 0.016,
  yaw: 0,
  mode: 'idle', // 'idle' | 'thinking' | 'speaking', from faceState
  cur: { ...PRESETS.idle },
  inner: [...INNER.idle],
  lastNow: -1,

  // ---- per-frame results of the event animations ---------------------------------------
  wakeShell: 1, // 0 to 1: how far the shell has expanded
  wakeInner: 1, // 0 to ~1.05: how far the inner layers have snapped in
  heart: 0, // 0 to 1: typing brightness
  squeeze: 0, // 0 to 1: how contracted the orb is (send)
  waves: [], // rings travelling through the shell: { r, a, w } (typing rings and the flash ring)
  uni: 0, // a brief extra brightness for the whole shell (after the flash hits)
  flashGlow: 0, // 0 to 1: the flash's glow at the heart
  pulses: [], // thinking pulses: { dir, p } with p 0 to 1 from the heart to the shell
  env: 0, // the speaking pulse, 0 to 1

  // ---- internal event stamps (in shared time) ------------------------------------------
  _wakeAt: -Infinity,
  _contractAt: -Infinity,
  _flashAt: -Infinity,
  _rings: [],
  _lastRingMs: -Infinity,
  _typeUntil: 0,
  _bump: 0,
  _bumpAt: -Infinity,
  _fed: 0,
  _pulses: [],
  _nextPulse: 0,

  tick(now) {
    if (now <= this.lastNow) return this.dt // the other orb already advanced this frame
    const dt = this.lastNow < 0 ? 0.016 : Math.min((now - this.lastNow) / 1000, 0.05)
    this.lastNow = now
    this.dt = dt
    this.t += dt
    const T = this.t
    const ease = Math.min(dt * 3, 1)

    // state and the eased look
    const want = orbStateName(faceState)
    this.mode = want
    const tg = PRESETS[want]
    for (const q of Object.keys(tg)) this.cur[q] += (tg[q] - this.cur[q]) * ease
    const it = INNER[want]
    for (let i = 0; i < 3; i++) this.inner[i] += (it[i] - this.inner[i]) * ease
    this.yaw += dt * this.cur.spin

    // 1. wake-up
    const wa = T - this._wakeAt
    this.wakeShell = wa >= WAKE.duration ? 1 : EASE.outCubic(clamp01(wa / WAKE.duration))
    this.wakeInner =
      wa >= WAKE.innerDelay + WAKE.innerDuration
        ? 1
        : EASE.outBack(clamp01((wa - WAKE.innerDelay) / WAKE.innerDuration))

    // 2. typing: the heart, the squeeze on send, and the rings
    this.heart += ((T < this._typeUntil ? 1 : 0) - this.heart) * Math.min(dt * TYPING.heartEase, 1)
    if (this.heart < 0.001) this.heart = 0
    const ca = T - this._contractAt
    const { inTime: ci, holdTime: ch, releaseTime: cr } = CONTRACT
    this.squeeze =
      ca < 0
        ? 0
        : ca < ci
          ? EASE.smooth(ca / ci)
          : ca < ci + ch
            ? 1
            : ca < ci + ch + cr
              ? 1 - EASE.smooth((ca - ci - ch) / cr)
              : 0
    while (this._rings.length && T - this._rings[0] > TYPING.ringLife) this._rings.shift()
    const waves = []
    for (const born of this._rings) {
      const p = (T - born) / TYPING.ringLife
      waves.push({
        r: TYPING.ringFrom + (TYPING.ringTo - TYPING.ringFrom) * EASE.outQuad(p),
        a: TYPING.ringStrength * (1 - p),
        w: TYPING.ringWidth,
      })
    }

    // 3. thinking pulses: a few at a time, only while thinking
    if (want === 'thinking' && T >= this._nextPulse && this._pulses.length < THINK.maxActive) {
      this._pulses.push({ dir: randUnit(), born: T })
      this._nextPulse = T + THINK.interval * rnd(0.7, 1.3)
    }
    while (this._pulses.length && T - this._pulses[0].born > THINK.life) this._pulses.shift()
    this.pulses = this._pulses.map((q) => ({ dir: q.dir, p: (T - q.born) / THINK.life }))

    // 3b. the flash: a ring that hits the shell, then a held glow that fades
    const fa = (T - this._flashAt) / FLASH.duration
    this.uni = 0
    this.flashGlow = 0
    if (fa >= 0 && fa < 1) {
      const hit = FLASH.hitAt
      const ring = EASE.outQuad(clamp01(fa / hit))
      if (fa < hit) waves.push({ r: TYPING.ringFrom + (1 - TYPING.ringFrom) * ring, a: FLASH.strength, w: FLASH.width })
      const after = fa < hit ? 0 : 1 - (fa - hit) / (1 - hit)
      this.uni = FLASH.shellBoost * after
      this.flashGlow = fa < hit ? ring : after
    }
    this.waves = waves

    // 4. speaking: real text bumps the pulse; the synthetic envelope is the fallback
    this._bump *= Math.exp(-dt / BUMP.decay)
    const fresh = T - this._bumpAt < BUMP.freshFor
    this._fed += ((fresh ? 1 : 0) - this._fed) * Math.min(dt * BUMP.ease, 1)
    const syn = 0.5 + 0.5 * Math.sin(T * 9) * Math.sin(T * 2.3 + 1) * Math.sin(T * 4.1)
    const real = BUMP.floor + (1 - BUMP.floor) * Math.min(1, this._bump)
    this.env = want === 'speaking' ? (1 - this._fed) * syn + this._fed * real : 0

    return dt
  },

  // ---- hooks for the chat (all no-ops with reduced motion) -----------------------------
  /** The chat opened: the orb starts as a dim point and wakes up. */
  wake() {
    if (!reduced()) this._wakeAt = this.t
  },
  /** One soft ring from the heart through the shell, at most TYPING.maxPerSec per second. */
  pulse() {
    if (reduced()) return
    const ms = performance.now()
    if (ms - this._lastRingMs < 1000 / TYPING.maxPerSec) return
    this._lastRingMs = ms
    this._rings.push(this.t)
    if (this._rings.length > TYPING.maxRings) this._rings.shift()
  },
  /** A keystroke: the heart brightens and a ring goes out. */
  type() {
    if (reduced()) return
    this._typeUntil = this.t + TYPING.hold
    this.pulse()
  },
  /** The message was sent: the whole orb squeezes, then releases. */
  contract() {
    if (reduced()) return
    this._typeUntil = 0
    this._contractAt = this.t
  },
  /** The first response token: one bright flash that hits the shell. */
  flash() {
    if (!reduced()) this._flashAt = this.t
  },
  /** A chunk or sentence of the answer arrived (strength 0 to 1). */
  bump(strength = 1) {
    if (reduced()) return
    this._bump = Math.min(1, this._bump + BUMP.gain * strength)
    this._bumpAt = this.t
  },
}
