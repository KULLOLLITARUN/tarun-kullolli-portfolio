import { describe, expect, it } from 'vitest'
import { dockPose, dockSide, jumpPose, springStep, tickWobble } from './kairoMotion.js'

describe('jumpPose', () => {
  it('is at rest before the start and after the end', () => {
    for (const k of [-1, 0, 1, 2]) expect(jumpPose(k, 16)).toEqual({ y: 0, sy: 1 })
  })
  it('crouches first, rises in the middle, squashes on landing', () => {
    expect(jumpPose(0.1, 16).sy).toBeLessThan(1)
    expect(jumpPose(0.1, 16).y).toBeGreaterThan(0)
    expect(jumpPose(0.375, 16).y).toBeLessThan(-8)
    expect(jumpPose(0.375, 16).sy).toBeGreaterThan(1)
    expect(jumpPose(0.7, 16).sy).toBeLessThan(1)
  })
  it('scales the height', () => {
    expect(Math.abs(jumpPose(0.375, 20).y)).toBeGreaterThan(Math.abs(jumpPose(0.375, 10).y))
  })
})

describe('springStep', () => {
  const run = (kick, steps = 90) => {
    let s = { x: 0, v: 0 }
    let peak = 0
    let crossed = false
    s = springStep(s, kick, 1 / 60, 200, 9)
    for (let i = 0; i < steps; i++) {
      const prev = s.x
      s = springStep(s, 0, 1 / 60, 200, 9)
      peak = Math.max(peak, Math.abs(s.x))
      if (prev * s.x < 0) crossed = true
    }
    return { s, peak, crossed }
  }
  it('stays at rest with no kick', () => {
    expect(springStep({ x: 0, v: 0 }, 0, 1 / 60, 200, 9)).toEqual({ x: 0, v: 0 })
  })
  it('overshoots once or more, then settles', () => {
    const { s, peak, crossed } = run(100)
    expect(peak).toBeGreaterThan(3)
    expect(crossed).toBe(true)
    expect(Math.abs(s.x)).toBeLessThan(0.1)
  })
  it('never swings past the limit', () => {
    expect(run(5000).peak).toBeLessThanOrEqual(14)
  })
})

describe('tickWobble', () => {
  it('swings right after the tick, then settles at exactly 0', () => {
    const peak = Math.max(...Array.from({ length: 60 }, (_, i) => Math.abs(tickWobble(i * 3))))
    expect(peak).toBeGreaterThan(0.5)
    expect(peak).toBeLessThan(1.5)
    expect(tickWobble(350)).toBe(0)
    expect(tickWobble(900)).toBe(0)
    expect(tickWobble(-5)).toBe(0)
  })
})

describe('dock', () => {
  it('parks above the tour bar, inside the screen, on the requested side', () => {
    const r = dockPose(1280, 800, 90, 'right')
    expect(r.h).toBe(144)
    expect(r.x + r.h * 0.8).toBe(1280 - 16)
    expect(r.y + r.h).toBeLessThanOrEqual(800 - 90 - 16)
    expect(dockPose(1280, 800, 90, 'left').x).toBe(16)
  })
  it('stays small on phones and never goes off the top', () => {
    expect(dockPose(390, 700, 140, 'right').h).toBe(126)
    expect(dockPose(390, 400, 300, 'right').y).toBe(16)
  })
  it('picks the side away from the target', () => {
    expect(dockSide(900, 1280)).toBe('left')
    expect(dockSide(200, 1280)).toBe('right')
    expect(dockSide(null, 1280)).toBe('right')
  })
})
