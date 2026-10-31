import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyTheme, availableThemes, recruiterTheme, setTheme, storedTheme, themeState, THEMES } from '../src/theme.js'

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

// A stand-in page: records the colour variables, the theme name, the address-bar colour, what was
// remembered and which events fired. `transition` adds the browser's view-transition support.
function page({ stored = null, narrow = false, reduce = false, transition = false, storageThrows = false } = {}) {
  const props = {}
  const saved = {}
  const events = []
  const meta = { content: '', setAttribute(_, v) { this.content = v } }
  const animate = vi.fn()
  const root = { style: { setProperty: (k, v) => (props[k] = v) }, dataset: {}, animate }
  const startViewTransition = vi.fn((update) => {
    update()
    return { ready: Promise.resolve() }
  })
  vi.stubGlobal('localStorage', {
    getItem: () => stored,
    setItem: storageThrows
      ? () => {
          throw new Error('storage is full')
        }
      : (k, v) => (saved[k] = v),
  })
  vi.stubGlobal('window', {
    matchMedia: (q) => ({ matches: q.includes('reduced-motion') ? reduce : narrow }),
    dispatchEvent: (e) => events.push(e),
  })
  vi.stubGlobal('document', { documentElement: root, querySelector: () => meta, ...(transition && { startViewTransition }) })
  vi.stubGlobal('innerWidth', 1000)
  vi.stubGlobal('innerHeight', 800)
  applyTheme('night') // every test starts from Night
  return { props, saved, events, meta, root, animate, startViewTransition }
}

const TOKENS = ['accent', 'accentHi', 'accentPale', 'glass', 'glassSoft', 'glassHi', 'glassPale', 'glassDeep', 'tickA', 'tickB', 'shoe', 'kicker']

describe('theme data', () => {
  it.each(THEMES.map((t) => [t.id, t]))('%s has every colour as three whole numbers from 0 to 255', (_, t) => {
    for (const k of TOKENS) {
      expect(t[k], `${t.id}.${k}`).toHaveLength(3)
      for (const n of t[k]) expect(Number.isInteger(n) && n >= 0 && n <= 255, `${t.id}.${k}`).toBe(true)
    }
  })

  it('has unique ids, starts with Night, and only Day is light and phone-only', () => {
    const ids = THEMES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids[0]).toBe('night')
    expect(THEMES.filter((t) => t.narrowOnly).map((t) => t.id)).toEqual(['day'])
    expect(THEMES.filter((t) => t.light).map((t) => t.id)).toEqual(['day'])
  })
})

describe('availableThemes', () => {
  it('leaves Day out on a wide screen', () => {
    page({ narrow: false })
    const ids = availableThemes().map((t) => t.id)
    expect(ids).toHaveLength(THEMES.length - 1)
    expect(ids).not.toContain('day')
  })

  it('adds Day on a phone', () => {
    page({ narrow: true })
    expect(availableThemes().map((t) => t.id)).toContain('day')
    expect(availableThemes()).toHaveLength(THEMES.length)
  })
})

describe('applyTheme', () => {
  it('sets all 12 colour variables as "r, g, b", the theme name and the scene state', () => {
    const p = page()
    applyTheme('dawn')
    expect(Object.keys(p.props)).toHaveLength(TOKENS.length)
    expect(p.props['--accent-rgb']).toBe('251, 154, 138')
    expect(p.props['--accent-hi-rgb']).toBe('253, 186, 170')
    expect(p.props['--tick-a-rgb']).toBe('167, 139, 250')
    expect(p.root.dataset.theme).toBe('dawn')
    expect(themeState.id).toBe('dawn')
    expect(themeState.colors.id).toBe('dawn')
  })

  it('colours the browser address bar light for Day and black for the rest', () => {
    const p = page()
    applyTheme('day')
    expect(p.meta.content).toBe('#f5f6fa')
    applyTheme('mocha')
    expect(p.meta.content).toBe('#000000')
  })

  it('falls back to Night for an unknown theme', () => {
    const p = page()
    applyTheme('nope')
    expect(p.root.dataset.theme).toBe('night')
  })
})

describe('setTheme', () => {
  it('switches, remembers the choice and announces it', () => {
    const p = page({ reduce: true })
    const t = setTheme('aurora')
    expect(t.id).toBe('aurora')
    expect(themeState.id).toBe('aurora')
    expect(p.saved['tk-theme']).toBe('aurora')
    expect(p.events).toHaveLength(1)
    expect(p.events[0].type).toBe('theme-change')
    expect(p.events[0].detail.id).toBe('aurora')
  })

  it('does nothing when that theme is already on screen', () => {
    const p = page({ reduce: true })
    setTheme('night')
    expect(p.saved).toEqual({})
    expect(p.events).toHaveLength(0)
  })

  it('refuses Day on a wide screen: nothing is saved or announced', () => {
    const p = page({ narrow: false, reduce: true })
    setTheme('day')
    expect(themeState.id).toBe('night')
    expect(p.saved).toEqual({})
    expect(p.events).toHaveLength(0)
  })

  it('allows Day on a phone', () => {
    const p = page({ narrow: true, reduce: true })
    setTheme('day')
    expect(themeState.id).toBe('day')
    expect(p.saved['tk-theme']).toBe('day')
  })

  it('switches instantly, without the browser transition, when motion is reduced', () => {
    const p = page({ reduce: true, transition: true })
    setTheme('solar')
    expect(p.startViewTransition).not.toHaveBeenCalled()
    expect(themeState.id).toBe('solar')
  })

  it('uses one browser view transition and animates the sweep from the click point', async () => {
    const p = page({ reduce: false, transition: true })
    setTheme('dusk', { x: 100, y: 50 })
    expect(p.startViewTransition).toHaveBeenCalledTimes(1)
    expect(themeState.id).toBe('dusk')
    await vi.waitFor(() => expect(p.animate).toHaveBeenCalledTimes(1))
    const [{ clipPath }, options] = p.animate.mock.calls[0]
    expect(clipPath[0]).toBe('circle(0px at 100px 50px)')
    expect(options.pseudoElement).toBe('::view-transition-new(root)')
  })

  it('still switches and announces when the choice cannot be saved', () => {
    const p = page({ reduce: true, storageThrows: true })
    setTheme('mocha')
    expect(themeState.id).toBe('mocha')
    expect(p.events).toHaveLength(1)
  })
})
