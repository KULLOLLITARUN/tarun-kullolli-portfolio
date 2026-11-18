import { faceState } from '../chat/faceState.js'
import { orbStateName } from '../kairoOrb.js'
import {
  ASSEMBLE,
  BOLTS,
  BUMP,
  CONTRACT,
  DASH,
  EASE,
  ENERGY,
  FLASH,
  HEART,
  INNER,
  LIGHT,
  PRESETS,
  THINK,
  TYPING,
  WAKE,
} from './orbTheme.js'

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
  mt: 0, // the glass mass's morph clock (folds and rim loops wobble at the state's morph speed)
  dash: 0, // how far the dashes have flowed along the sheet edges
  act: 0.3, // how lively the glass mass is: the state's act plus typing, flash and speech
  mode: 'idle', // 'idle' | 'thinking' | 'speaking', from faceState
  cur: { ...PRESETS.idle },
  inner: [...INNER.idle],
  lastNow: -1,

  // ---- per-frame results of the event animations ---------------------------------------
  wakeT: 1, // 0 to 1, linear: progress of the streaks flying in
  light: 0, // 0 to 1: the light the orb casts on the page
  wakeShell: 1, // 0 to 1: how far the shell has expanded
  wakeInner: 1, // 0 to 1: how far the inner layers have eased in
  heart: 0, // 0 to 1: typing brightness
  squeeze: 0, // 0 to 1: how contracted the orb is (send)
  waves: [], // rings travelling through the shell: { r, a, w } (typing rings and the flash ring)
  uni: 0, // a brief extra brightness for the whole shell (after the flash hits)
  flashGlow: 0, // 0 to 1: the flash's glow at the heart
  pulses: [], // thinking pulses (jagged bolts to the shell): { dir, p, jit } with p 0 to 1
  bolts: [], // energy bolts from the heart: { pts, k } with k 1 to 0 as they fade
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
  _bolts: [],
  _boltAcc: 0,

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
    this.mt += dt * this.cur.morph

    // 1. wake-up
    const wa = T - this._wakeAt
    this.wakeT = wa >= ASSEMBLE.duration ? 1 : clamp01(wa / ASSEMBLE.duration)
    this.wakeShell = wa >= WAKE.duration ? 1 : EASE.outCubic(clamp01(wa / WAKE.duration))
    this.wakeInner =
      wa >= WAKE.innerDelay + WAKE.innerDuration
        ? 1
        : EASE.smooth(clamp01((wa - WAKE.innerDelay) / WAKE.innerDuration))

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
      this._pulses.push({
        dir: randUnit(),
        born: T,
        jit: Array.from({ length: 7 }, () => [rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)]),
      })
      this._nextPulse = T + THINK.interval * rnd(0.7, 1.3)
    }
    while (this._pulses.length && T - this._pulses[0].born > THINK.life) this._pulses.shift()
    this.pulses = this._pulses.map((q) => ({ dir: q.dir, jit: q.jit, p: (T - q.born) / THINK.life }))

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

    // the glass mass's liveliness, its dashes and its bolts (shared, so both orbs show the same ones)
    this.act = Math.min(
      ENERGY.max,
      this.cur.act +
        ENERGY.typing * this.heart +
        ENERGY.flash * this.flashGlow +
        (want === 'speaking' ? ENERGY.speech * this.env : 0),
    )
    this.dash += dt * (DASH.base + DASH.perAct * this.act)
    this._boltAcc = Math.min(2, this._boltAcc + dt * (BOLTS.base + BOLTS.perAct * this.act))
    while (this._boltAcc >= 1) {
      this._boltAcc -= 1
      if (this._bolts.length >= BOLTS.maxActive) continue
      const d = randUnit()
      const rr = rnd(BOLTS.reachMin, BOLTS.reachMax)
      const pts = []
      for (let i = 0; i <= 10; i++) {
        const u = i / 10
        const j = i === 0 ? 0 : BOLTS.jitter
        pts.push(HEART.map((h, a) => h + (d[a] * rr - h) * u + rnd(-j, j)))
      }
      const life = rnd(BOLTS.lifeMin, BOLTS.lifeMax)
      this._bolts.push({ pts, life, max: life })
    }
    for (let i = this._bolts.length - 1; i >= 0; i--) {
      this._bolts[i].life -= dt
      if (this._bolts[i].life <= 0) this._bolts.splice(i, 1)
    }
    this.bolts = this._bolts.map((b) => ({ pts: b.pts, k: b.life / b.max }))

    // the light cast on the page follows the heart, the flash and the speech
    const lt =
      LIGHT.base +
      LIGHT.heart * this.heart +
      LIGHT.flash * this.flashGlow +
      (want === 'speaking' ? LIGHT.speech * this.env : 0) +
      (want === 'thinking' ? LIGHT.thinking : 0)
    this.light += (Math.min(1, lt) * clamp01(this.wakeInner) - this.light) * Math.min(dt * LIGHT.ease, 1)

    return dt
  },

  // ---- hooks for the chat (all no-ops with reduced motion) -----------------------------
  /** The chat opened: the orb starts as a dim point and wakes up. */
  wake() {
    if (reduced()) return
    this._wakeAt = this.t
    window.dispatchEvent(new Event('orb-wake')) // TourParticles gathers the name's particles into the orb
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
