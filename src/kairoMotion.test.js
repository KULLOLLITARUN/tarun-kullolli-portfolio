import { describe, expect, it } from 'vitest'
import { jumpPose } from './kairoMotion.js'

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
