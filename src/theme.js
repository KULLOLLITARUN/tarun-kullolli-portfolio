// Time-of-day colour themes. Clicking Tick rings its alarm and opens a picker (Mascot.jsx);
// the Ctrl+K palette lists them too. Each theme sets the CSS colour tokens (styles.css reads them as `rgb(var(--x-rgb))`)
// and the particle scene eases its colours toward `themeState.colors`.
// Recruiter mode always uses Night.

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
    tickA: [56, 189, 248], // Tick's body, light → dark
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
]

const KEY = 'tk-theme'
const byId = (id) => THEMES.find((t) => t.id === id) || THEMES[0]
const TOKENS = ['accent', 'accentHi', 'accentPale', 'glass', 'glassSoft', 'glassHi', 'glassPale', 'glassDeep', 'tickA', 'tickB', 'shoe', 'kicker']
const cssName = (k) => `--${k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}-rgb`

// The theme on screen (read every frame by the particle scene).
export const themeState = { id: THEMES[0].id, colors: THEMES[0] }

export function storedTheme() {
  try {
    return byId(localStorage.getItem(KEY)).id
  } catch {
    return THEMES[0].id
  }
}

// Puts a theme on screen (no animation, not remembered).
export function applyTheme(id) {
  const t = byId(id)
  const root = document.documentElement
  for (const k of TOKENS) root.style.setProperty(cssName(k), t[k].join(', '))
  root.dataset.theme = t.id
  themeState.id = t.id
  themeState.colors = t
}

// Switches to a theme, remembers it, and sweeps it in as a circle growing from `origin`
// (CSS px; default: the middle of the screen) where the browser supports view transitions.
export function setTheme(id, origin = { x: innerWidth / 2, y: innerHeight / 2 }) {
  const t = byId(id)
  if (t.id === themeState.id) return t
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
