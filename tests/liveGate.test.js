// The live-model gate: after a failure the chat answers offline until the cooldown passes.
import { describe, expect, it } from 'vitest'
import { createLiveGate, DEFAULT_COOLDOWN_MS } from '../src/chat/liveGate.js'

const clock = () => {
  let t = 1_000_000
  return { now: () => t, advance: (ms) => (t += ms) }
}

describe('live gate', () => {
  it('lets the live model be tried at first', () => {
    expect(createLiveGate(clock().now).canTry()).toBe(true)
  })

  it('blocks after a failure, then allows a retry once the cooldown has passed', () => {
    const c = clock()
    const gate = createLiveGate(c.now)
    gate.fail()
    expect(gate.canTry()).toBe(false)
    c.advance(DEFAULT_COOLDOWN_MS - 1)
    expect(gate.canTry()).toBe(false)
    c.advance(1)
    expect(gate.canTry()).toBe(true)
  })

  it('follows the provider’s retry-after, within sane limits', () => {
    const c = clock()
    const gate = createLiveGate(c.now)
    gate.fail(90)
    c.advance(89_000)
    expect(gate.canTry()).toBe(false)
    c.advance(1_000)
    expect(gate.canTry()).toBe(true)
    gate.fail(1) // never shorter than 30 seconds
    c.advance(29_000)
    expect(gate.canTry()).toBe(false)
    gate.fail(999_999) // never longer than an hour
    c.advance(60 * 60 * 1000)
    expect(gate.canTry()).toBe(true)
  })

  it('opens again straight away after a success', () => {
    const gate = createLiveGate(clock().now)
    gate.fail()
    gate.ok()
    expect(gate.canTry()).toBe(true)
  })
})
