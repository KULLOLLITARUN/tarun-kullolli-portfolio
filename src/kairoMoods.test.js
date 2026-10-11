import { describe, expect, it } from 'vitest'
import { IDLE, moodForHour } from './kairoMoods.js'

describe('moodForHour', () => {
  it('is sleepy from 22:00 to 04:59', () => {
    for (const h of [22, 23, 0, 3, 4]) expect(moodForHour(h)).toBe('late')
  })
  it('stretches from 05:00 to 10:59', () => {
    for (const h of [5, 8, 10]) expect(moodForHour(h)).toBe('morning')
  })
  it('checks its wrist around lunch (12:00-13:59)', () => {
    for (const h of [12, 13]) expect(moodForHour(h)).toBe('lunch')
  })
  it('has nothing extra the rest of the day', () => {
    for (const h of [11, 14, 17, 21]) expect(moodForHour(h)).toBeNull()
  })
  it('covers every hour with a known mood or none', () => {
    for (let h = 0; h < 24; h++) {
      const m = moodForHour(h)
      expect(m === null || m in IDLE).toBe(true)
    }
  })
})
