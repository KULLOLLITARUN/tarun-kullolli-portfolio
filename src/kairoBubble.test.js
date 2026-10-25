import { describe, expect, it } from 'vitest'
import { cueText, helloWanted } from './kairoBubble.js'

describe('helloWanted', () => {
  it('greets a first-time visitor', () => {
    expect(helloWanted('', false)).toBe(true)
  })
  it('never greets again once seen', () => {
    expect(helloWanted('', true)).toBe(false)
    expect(helloWanted('?recruiter', true)).toBe(false)
  })
  it('replays with ?hello', () => {
    expect(helloWanted('?hello', true)).toBe(true)
  })
})

describe('cueText', () => {
  it('gives each line once, then nothing', () => {
    const shown = new Set()
    expect(cueText('work', shown)).toBe('Projects are just below')
    shown.add('work')
    expect(cueText('work', shown)).toBeNull()
    expect(cueText('tour', shown)).toBe("I'll show you around")
  })
  it('ignores unknown cues', () => {
    expect(cueText('nope', new Set())).toBeNull()
  })
})
