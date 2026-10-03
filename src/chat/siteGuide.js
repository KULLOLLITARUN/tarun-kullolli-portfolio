// How to use the site, one line per feature. Kairo answers "what can I do here?" with it:
// the live model gets it in its prompt (prompt.js), the offline engine replies with it (engine.js).
// Keep it in step with the site when a section or feature changes.
import { THEMES } from '../theme.js'

const themeNames = THEMES.map((t) => t.name).join(', ')

export const SITE_GUIDE = [
  'Top of the page: Tarun’s name, Kairo (the alarm-clock mascot) and this chat. “Take the 60-second tour” scrolls through the whole page for you (Back, Pause, Next; Esc ends it).',
  'Work: his projects as case studies. Click a card for the problem, approach, results and architecture; each has its own shareable link and an “Ask Kairo about this” button.',
  'Journey: his career timeline. A mini Kairo walks along it as you scroll; hover an entry to send it there.',
  'Skills: skills and tools, education and certifications.',
  'Contact: email (with a copy button), phone, LinkedIn, GitHub and the resume PDF.',
  'Recruiter mode (switch in the top bar): a plain one-page version of his resume, without animations.',
  'Command menu: press Ctrl+K (Cmd+K on a Mac) or the ⌘ button to jump to a section, copy his email, download the resume, start the tour or change colours.',
  `Colours: click Kairo to ring its alarm and pick a time of day (${themeNames}).`,
  'Kairo’s clock hands show your local time. It dozes off when left alone and gets grumpy at off-topic questions.',
  'Questions asked in this chat are saved anonymously (just the question and the time) so Tarun can improve the answers.',
]
