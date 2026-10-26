// How to use the site, one line per feature. Kairo answers "what can I do here?" with it:
// the live model gets it in its prompt (prompt.js), the offline engine replies with it (engine.js).
// Keep it in step with the site when a section or feature changes.
import { experiments } from '../data.js'
import { THEMES } from '../theme.js'

const themeNames = THEMES.filter((t) => !t.narrowOnly).map((t) => t.name).join(', ')
const walkthroughs = experiments.filter((e) => e.demo).map((e) => e.title).join(', ')
const phoneThemes = THEMES.filter((t) => t.narrowOnly).map((t) => t.name)

export const SITE_GUIDE = [
  'Top of the page: Tarun’s name, Kairo (the alarm-clock mascot) and this chat. “Take the 60-second tour” has Kairo shrink into the corner and walk you through the whole page, pointing at each project (Back, Pause, Next; Esc ends it).',
  'Work: his projects as case studies. Click a card for the problem, approach, results and architecture; each has its own shareable link and an “Ask Kairo about this” button.',
  `A “How it works” walk-through (play, pause, step through) opens each case study for ${walkthroughs}.`,
  'On a phone, the menu button (top right) holds the section links, the tour and Recruiter mode.',
  'Journey: his career timeline. A mini Kairo walks along it as you scroll; hover an entry to send it there.',
  'Skills: skills and tools, education and certifications.',
  'Contact: email (with a copy button), phone, LinkedIn, GitHub and the resume PDF.',
  'Recruiter mode (switch in the top bar): a plain one-page version of his resume, without animations.',
  'Command menu: press Ctrl+K (Cmd+K on a Mac) or the ⌘ button to jump to a section, copy his email, download the resume, start the tour or change colours.',
  `Colours: click Kairo to ring its alarm and pick a time of day (${themeNames}). On a phone there is also a light theme (${phoneThemes.join(', ')}).`,
  'Kairo’s clock hands show your local time. It dozes off when left alone and gets grumpy at off-topic questions.',
]
