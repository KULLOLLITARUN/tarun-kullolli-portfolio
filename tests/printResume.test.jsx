// The printed résumé (PrintResume.jsx), rendered to HTML.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import PrintResume from '../src/components/PrintResume.jsx'
import { education, experiments, profile } from '../src/data.js'

const html = renderToStaticMarkup(<PrintResume />)
// The HTML of one section, so a name mentioned elsewhere (e.g. in the summary) doesn't count.
const section = (title) => html.slice(html.indexOf(`<h2>${title}</h2>`)).split('</section>')[0]
const inOrder = (labels, within = html) => {
  const at = labels.map((l) => within.indexOf(l))
  return at.every((p) => p >= 0) && at.every((p, i) => i === 0 || p > at[i - 1])
}

describe('printed résumé', () => {
  it('follows the order of resume.pdf', () => {
    const headings = ['Summary', 'Education', 'Skills', 'Experience', 'Projects', 'Certifications'].map((h) => `<h2>${h}</h2>`)
    expect(inOrder(headings)).toBe(true)
  })

  it('lists education oldest first', () => {
    expect(inOrder([...education].reverse().map((e) => e.school), section('Education'))).toBe(true)
  })

  it('lists experience oldest first', () => {
    expect(inOrder(['Besant Technologies', 'Quintesys'], section('Experience'))).toBe(true)
  })

  it('has the name and contact details with written-out links', () => {
    expect(html).toContain(profile.name)
    expect(html).toContain(`mailto:${profile.email}`)
    expect(html).toContain('github.com/KULLOLLITARUN')
  })

  it('links each project’s code, and the live demo where there is one', () => {
    for (const e of experiments) {
      expect(html).toContain(`href="${e.links.code}"`)
      if (e.links.live && e.links.live !== '#') expect(html).toContain(`href="${e.links.live}"`)
    }
  })

  it('never prints a placeholder link', () => {
    expect(html).not.toContain('href="#"')
  })
})
