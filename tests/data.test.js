// data.js feeds the whole site, recruiter mode, the printed résumé and Kairo, so a mistake there
// shows up everywhere. These checks catch the common ones.
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { projectSlug } from '../src/components/Holo.jsx'
import { SITE_GUIDE } from '../src/chat/siteGuide.js'
import { acts, currentJob, education, experiments, profile, skills } from '../src/data.js'
import { THEMES } from '../src/theme.js'

describe('profile', () => {
  it('has the basics', () => {
    expect(profile.name).toBeTruthy()
    expect(profile.email).toMatch(/^\S+@\S+\.\S+$/)
    expect(profile.resume).toBe('/resume.pdf')
    expect(existsSync('public/resume.pdf')).toBe(true)
  })
})

describe('projects', () => {
  it.each(experiments.map((e) => [e.title, e]))('%s has the fields the cards and résumé need', (_, e) => {
    for (const field of ['code', 'title', 'subtitle', 'description', 'result']) expect(e[field], field).toBeTruthy()
    expect(e.stack.length).toBeGreaterThan(0)
    expect(e.links.code).toMatch(/^https:\/\/github\.com\//)
    if (e.architecture) expect(e.architecture.length).toBeLessThanOrEqual(6)
  })

  it('have unique share links (#project/<slug>)', () => {
    const slugs = experiments.map(projectSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('keeps old share links (aliases) from clashing with any current link', () => {
    const all = [...experiments.map(projectSlug), ...experiments.flatMap((e) => e.aliases || [])]
    expect(new Set(all).size).toBe(all.length)
  })

  it.each(experiments.filter((e) => e.shots).map((e) => [e.title, e]))('%s screenshots exist in public/', (_, e) => {
    for (const s of e.shots) {
      expect(existsSync(`public${s.src}`), s.src).toBe(true)
      expect(s.width).toBeGreaterThan(0)
      expect(s.height).toBeGreaterThan(0)
      expect(s.alt).toBeTruthy()
    }
  })
})

describe('career and education', () => {
  it('has exactly one current job', () => {
    expect(acts.filter((a) => /present/i.test(a.period))).toHaveLength(1)
    expect(currentJob).toBeTruthy()
  })

  it('has periods that start with a parseable date', () => {
    for (const a of acts.filter((x) => x.name !== 'Foundations' && x.name !== 'Next')) {
      expect(Number.isNaN(Date.parse(`1 ${a.period.split(/[–-]/)[0].trim()}`)), a.period).toBe(false)
    }
  })

  it('has education and non-empty skill groups', () => {
    expect(education.length).toBeGreaterThan(0)
    expect(skills.some((g) => g.items.length)).toBe(true)
  })
})

describe('site guide', () => {
  it('names every colour theme', () => {
    const colours = SITE_GUIDE.find((l) => l.startsWith('Colours:'))
    for (const t of THEMES) expect(colours).toContain(t.name)
  })
})
