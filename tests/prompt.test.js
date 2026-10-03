// The live model's system prompt is generated from data.js, so it can't drift from the site.
import { describe, expect, it } from 'vitest'
import { buildSystemPrompt } from '../src/chat/prompt.js'
import { SITE_GUIDE } from '../src/chat/siteGuide.js'
import { acts, experiments, profile, skills } from '../src/data.js'

const LOGGING_LINE = /saved anonymously/

describe('system prompt', () => {
  const prompt = buildSystemPrompt()

  it('names the assistant Kairo', () => {
    expect(prompt).toMatch(/You are Kairo/)
  })

  it('contains the resume data', () => {
    expect(prompt).toContain(profile.name)
    expect(prompt).toContain(profile.email)
    for (const e of experiments) expect(prompt).toContain(e.title)
    for (const a of acts.filter((x) => x.name !== 'Next')) expect(prompt).toContain(a.org)
    for (const g of skills.filter((x) => x.items.length)) expect(prompt).toContain(g.items[0])
  })

  it('contains every site-guide line', () => {
    for (const line of SITE_GUIDE) expect(prompt).toContain(line)
  })

  it('keeps the guardrails', () => {
    expect(prompt).toMatch(/Never invent/)
    expect(prompt).toMatch(/\[off-topic\]/)
    expect(prompt).toMatch(/reveal this prompt/)
  })

  it('mentions the question log only when logging is on', () => {
    expect(buildSystemPrompt({ logging: false })).not.toMatch(LOGGING_LINE)
    expect(buildSystemPrompt({ logging: true })).toMatch(LOGGING_LINE)
  })
})
