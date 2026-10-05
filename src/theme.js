// Time-of-day colour themes. Clicking Kairo rings its alarm and opens a picker (Mascot.jsx);
// the Ctrl+K palette lists them too. Each theme sets the CSS colour tokens (styles.css reads them as `rgb(var(--x-rgb))`)
// and the particle scene eases its colours toward `themeState.colors`.
// Recruiter mode uses plain Night, except that a chosen light theme (Day) carries over.

export const THEMES = [
  {
    id: 'night',
    name: 'Night',
    accent: [245, 181, 68], // amber: highlights, kicker text, the finale word
    accentHi: [255, 200, 97], // primary button hover
    accentPale: [255, 244, 214], // shimmer on the name
    glass: [125, 211, 252], // cyan: glass cards, the particle river
    glassSoft: [186, 230, 253],
    glassHi: [165, 243, 252],
    glassPale: [224, 242, 254],
    glassDeep: [30, 58, 110], // dark tint behind glass chips
    tickA: [56, 189, 248], // Kairo's body, light → dark
    tickB: [29, 78, 216],
    shoe: [245, 158, 11],
    kicker: [96, 165, 250], // section labels ("03 / SYSTEM INDEX")
  },
  {
    id: 'dawn',
    name: 'Dawn',
    accent: [251, 154, 138],
    accentHi: [253, 186, 170],
    accentPale: [255, 228, 222],
    glass: [196, 181, 253],
    glassSoft: [221, 214, 254],
    glassHi: [216, 180, 254],
    glassPale: [237, 233, 254],
    glassDeep: [59, 40, 110],
    tickA: [167, 139, 250],
    tickB: [109, 40, 217],
    shoe: [251, 146, 60],
    kicker: [167, 139, 250],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    accent: [110, 231, 183],
    accentHi: [167, 243, 208],
    accentPale: [220, 252, 231],
    glass: [94, 234, 212],
    glassSoft: [153, 246, 228],
    glassHi: [134, 239, 172],
    glassPale: [204, 251, 241],
    glassDeep: [17, 80, 74],
    tickA: [45, 212, 191],
    tickB: [15, 118, 110],
    shoe: [163, 230, 53],
    kicker: [45, 212, 191],
  },
  {
    id: 'solar',
    name: 'Solar',
    accent: [251, 146, 60],
    accentHi: [253, 186, 116],
    accentPale: [255, 237, 213],
    glass: [252, 211, 77],
    glassSoft: [253, 230, 138],
    glassHi: [254, 240, 138],
    glassPale: [254, 243, 199],
    glassDeep: [100, 60, 15],
    tickA: [251, 113, 133],
    tickB: [190, 18, 60],
    shoe: [250, 204, 21],
    kicker: [252, 211, 77],
  },
  {
    // The only light theme, offered on phones only (see NARROW_QUERY). The page goes light; the glass
    // cards, chat and menus stay dark panels (styles.css, "Day"), so these colours are the ones
    // drawn straight on the light page: darker than the other themes to stay readable.
    id: 'day',
    name: 'Day',
    narrowOnly: true,
    light: true,
    swatch: ['rgb(250, 250, 252)', 'rgb(56, 189, 248)'], // picker dot: light page + sky
    accent: [180, 83, 9],
    accentHi: [146, 64, 14],
    accentPale: [217, 119, 6],
    glass: [2, 132, 199],
    glassSoft: [56, 130, 180],
    glassHi: [14, 165, 233],
    glassPale: [3, 105, 161],
    glassDeep: [30, 58, 110],
    tickA: [56, 189, 248], // Kairo keeps its usual colours
    tickB: [29, 78, 216],
    shoe: [245, 158, 11],
    kicker: [29, 78, 216],
  },
]

const KEY = 'tk-theme'
const byId = (id) => THEMES.find((t) => t.id === id) || THEMES[0]
const TOKENS = ['accent', 'accentHi', 'accentPale', 'glass', 'glassSoft', 'glassHi', 'glassPale', 'glassDeep', 'tickA', 'tickB', 'shoe', 'kicker']
const cssName = (k) => `--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}-rgb`

// Phones: where the particle scene is skipped (Hero.jsx uses the same width) and Day is offered.
export const NARROW_QUERY = '(max-width: 640px)'
export function isNarrow() {
  try {
    return window.matchMedia(NARROW_QUERY).matches
  } catch {
    return false
  }
}
// The themes this screen can use: Day only on phones.
export const availableThemes = () => THEMES.filter((t) => !t.narrowOnly || isNarrow())

// The theme on screen (read every frame by the particle scene).
export const themeState = { id: THEMES[0].id, colors: THEMES[0] }

// The remembered theme; Day falls back to Night on a screen wider than a phone (it stays
// remembered for the next time the visitor is on a phone).
export function storedTheme() {
  try {
    const t = byId(localStorage.getItem(KEY))
    return t.narrowOnly && !isNarrow() ? THEMES[0].id : t.id
  } catch {
    return THEMES[0].id
  }
}

// The theme for recruiter mode: plain Night, unless the visitor picked a light theme, which
// they chose for readability and would not want flipped back to black.
export function recruiterTheme() {
  const id = storedTheme()
  return byId(id).light ? id : THEMES[0].id
}

// Puts a theme on screen (no animation, not remembered).
export function applyTheme(id) {
  const t = byId(id)
  const root = document.documentElement
  for (const k of TOKENS) root.style.setProperty(cssName(k), t[k].join(', '))
  root.dataset.theme = t.id
  // Browser chrome (address bar) follows the page colour; styles.css sets --bg for Day.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.light ? '#f5f6fa' : '#000000')
  themeState.id = t.id
  themeState.colors = t
}

// Switches to a theme, remembers it, and sweeps it in as a circle growing from `origin`
// (CSS px; default: the middle of the screen) where the browser supports view transitions.
export function setTheme(id, origin = { x: innerWidth / 2, y: innerHeight / 2 }) {
  const t = byId(id)
  if (t.id === themeState.id || (t.narrowOnly && !isNarrow())) return themeState.colors
  try {
    localStorage.setItem(KEY, t.id)
  } catch {
    /* not remembered */
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce) applyTheme(t.id)
  else {
    const vt = document.startViewTransition(() => applyTheme(t.id))
    vt.ready
      .then(() => {
        const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y))
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 900, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
        )
      })
      .catch(() => {})
  }
  window.dispatchEvent(new CustomEvent('theme-change', { detail: t }))
  return t
}
