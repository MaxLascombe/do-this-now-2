import { describe, expect, it } from 'vitest'

import { computeSchedule } from '../pacing'

// Workday starts 8:30; the pacing window runs to midnight (930 minutes).
const at = (h: number, m: number) => new Date(2026, 0, 1, h, m)

describe('computeSchedule', () => {
  it('is before the workday and owes nothing before 8:30', () => {
    const s = computeSchedule(at(7, 0), 100, 0)
    expect(s.isBeforeWorkday).toBe(true)
    expect(s.shouldBeDone).toBe(0)
  })

  it('owes nothing exactly at the start of the workday', () => {
    const s = computeSchedule(at(8, 30), 100, 0)
    expect(s.isBeforeWorkday).toBe(false)
    expect(s.shouldBeDone).toBe(0)
  })

  it('owes half the target at the midpoint of the window', () => {
    const s = computeSchedule(at(16, 15), 100, 0)
    expect(s.shouldBeDone).toBeCloseTo(50)
    expect(s.isBeforeWorkday).toBe(false)
  })

  it('never owes more than the target late in the day', () => {
    const s = computeSchedule(at(23, 59), 100, 0)
    expect(s.shouldBeDone).toBeLessThanOrEqual(100)
    expect(s.shouldBeDone).toBeGreaterThan(99)
  })

  it('paces against the larger of todo and the reduce-tomorrow target', () => {
    const s = computeSchedule(at(16, 15), 10, 100)
    expect(s.shouldBeDone).toBeCloseTo(50)
  })
})
