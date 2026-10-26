// Kairo's offline engine: answers built from data.js when the live model is unavailable.
import { describe, expect, it } from 'vitest'
import { answer, GREETING, STARTER_CHIPS } from '../src/chat/engine.js'
import { experiments, profile } from '../src/data.js'
import { projectSlug } from '../src/projectSlug.js'

describe('offline engine', () => {
  it('introduces itself as Kairo and offers the site-guide chip', () => {
    expect(GREETING).toMatch(/Kairo/)
    expect(STARTER_CHIPS).toContain('What can I do here?')
  })

  it('answers about a specific project with its stack', () => {
    for (const e of experiments) {
      const a = answer(`Tell me about ${e.title}`)
      expect(a.text).toContain(e.title)
      expect(a.text).toContain(e.stack[0])
    }
  })

  it('lists every project when asked about projects in general', () => {
    const a = answer('What projects has he built?')
    for (const e of experiments) expect(a.text).toContain(e.title)
  })

  it('says yes to a skill on the resume', () => {
    expect(answer('Does he know Django?').text).toMatch(/^Yes/)
  })

  it('is honest about a skill that is not on the resume', () => {
    const a = answer('Does he know Kubernetes?')
    expect(a.text).not.toMatch(/^Yes/)
    expect(a.text).toMatch(/isn't on his resume/)
  })

  it('gives contact details with action links', () => {
    const a = answer('How can I contact him?')
    expect(a.text).toContain(profile.email)
    expect(a.actions?.length).toBeGreaterThan(0)
  })

  it('does not guess salary or notice period', () => {
    expect(answer('What is his salary expectation?').text).toMatch(/ask him directly/)
  })

  it('explains how to use the site', () => {
    expect(answer('What can I do here?').text).toMatch(/what you can do on this site/)
    expect(answer('How do I change the colours?').text).toMatch(/what you can do on this site/)
  })

  it('prefers a question about Tarun over the site guide on a tie', () => {
    expect(answer('What tools does he use?').text).not.toMatch(/on this site/)
    expect(answer('How do I contact him?').text).toContain(profile.email)
  })

  it('matches whole words only ("his" is not the greeting "hi")', () => {
    expect(answer('What are his skills?').text).not.toMatch(/^Hello/)
  })

  it('flags off-topic questions so the mascot can react', () => {
    const a = answer('What is the capital of France?')
    expect(a.miss).toBe(true)
    expect(a.followUps).toEqual(STARTER_CHIPS)
  })

  it('handles an empty question', () => {
    expect(answer('   ').text).toMatch(/Ask me anything/)
  })

  it('offers an "Open case study" link for each project, to its own #project address', () => {
    for (const e of experiments) {
      const open = answer(`Tell me about ${e.title}`).actions.find((a) => /case study/.test(a.label))
      expect(open.label).toBe(`Open ${e.title} case study`)
      expect(open.href).toMatch(/^#project\/[a-z0-9-]+$/)
      expect(open.href).toBe(`#project/${projectSlug(e)}`)
    }
  })

  it('offers to start the tour: a button that fires the start-tour event', () => {
    for (const q of ['Can you show me around?', 'Start the tour', 'What can I do here?']) {
      const start = answer(q).actions.find((a) => a.event)
      expect(start).toEqual({ label: 'Start the tour', event: 'start-tour' })
    }
  })

  it('every action is either a link or an event button, never both or neither', () => {
    for (const q of ['Tell me about Archiva', 'How can I contact him?', 'Show me around', 'What can I do here?']) {
      for (const a of answer(q).actions) expect(Boolean(a.href) !== Boolean(a.event)).toBe(true)
    }
  })
})
