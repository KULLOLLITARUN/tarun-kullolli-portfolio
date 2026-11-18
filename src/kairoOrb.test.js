import { describe, expect, it } from 'vitest'
import { orbStateName } from './kairoOrb.js'

describe('orbStateName', () => {
  it('is idle by default', () => {
    expect(orbStateName({ thinking: false, talking: false })).toBe('idle')
  })
  it('is thinking while an answer is prepared', () => {
    expect(orbStateName({ thinking: true, talking: false })).toBe('thinking')
  })
  it('is speaking while the answer is typed out', () => {
    expect(orbStateName({ thinking: false, talking: true })).toBe('speaking')
  })
  it('prefers thinking if both are set', () => {
    expect(orbStateName({ thinking: true, talking: true })).toBe('thinking')
  })
})
