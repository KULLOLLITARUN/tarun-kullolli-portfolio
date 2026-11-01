import { describe, expect, it } from 'vitest'
import { CORE_STATES, coreStateName } from './coreState.js'

describe('coreStateName', () => {
  it('is idle when nothing is happening', () => {
    expect(coreStateName({ thinking: false, talking: false, mood: 0 })).toBe('idle')
  })
  it('thinks while an answer loads and talks while it types out', () => {
    expect(coreStateName({ thinking: true, talking: false, mood: 0 })).toBe('thinking')
    expect(coreStateName({ thinking: false, talking: true, mood: 0 })).toBe('talking')
  })
  it('stays calm when only confused, and turns annoyed from the second off-topic question', () => {
    expect(coreStateName({ thinking: false, talking: false, mood: 1 })).toBe('idle')
    expect(coreStateName({ thinking: false, talking: false, mood: 2 })).toBe('annoyed')
    expect(coreStateName({ thinking: false, talking: false, mood: 3 })).toBe('annoyed')
  })
  it('annoyed wins over thinking and talking', () => {
    expect(coreStateName({ thinking: true, talking: true, mood: 3 })).toBe('annoyed')
  })
  it('has a look for every name it can return', () => {
    for (const n of ['idle', 'thinking', 'talking', 'annoyed']) expect(CORE_STATES[n]).toBeTruthy()
  })
})
