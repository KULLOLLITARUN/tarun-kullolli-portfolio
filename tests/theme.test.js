import { afterEach, describe, expect, it, vi } from 'vitest'
import { recruiterTheme, storedTheme } from '../src/theme.js'

// The remembered theme and the screen width are faked: there is no browser here.
function setup({ theme, narrow }) {
  vi.stubGlobal('localStorage', { getItem: () => theme })
  vi.stubGlobal('window', { matchMedia: () => ({ matches: narrow }) })
}
afterEach(() => vi.unstubAllGlobals())

describe('themes on different screens', () => {
  it('offers Day on a phone and falls back to Night on a wide screen', () => {
    setup({ theme: 'day', narrow: true })
    expect(storedTheme()).toBe('day')
    setup({ theme: 'day', narrow: false })
    expect(storedTheme()).toBe('night')
  })

  it('ignores an unknown remembered theme', () => {
    setup({ theme: 'nope', narrow: true })
    expect(storedTheme()).toBe('night')
  })
})

describe('recruiter mode theme', () => {
  it('keeps the light Day theme on a phone', () => {
    setup({ theme: 'day', narrow: true })
    expect(recruiterTheme()).toBe('day')
  })

  it('is plain Night for the dark themes', () => {
    for (const theme of ['night', 'dawn', 'aurora', 'solar']) {
      setup({ theme, narrow: true })
      expect(recruiterTheme(), theme).toBe('night')
    }
  })

  it('is Night on a wide screen even if Day was picked on a phone', () => {
    setup({ theme: 'day', narrow: false })
    expect(recruiterTheme()).toBe('night')
  })
})
