import { describe, expect, it } from 'vitest'

import { computeSchedule } from '../pacing'

// Default Workday 08:30–24:00 (930-minute pacing window).
const at = (h: number, m: number) => new Date(2026, 0, 1, h, m)
const START = 8 * 60 + 30
const END = 24 * 60

describe('computeSchedule', () => {
  it('is before the workday and owes nothing before 8:30', () => {
    const s = computeSchedule(at(7, 0), 100, START, END)
    expect(s.isBeforeWorkday).toBe(true)
    expect(s.shouldBeDone).toBe(0)
  })

  it('owes nothing exactly at the start of the workday', () => {
    const s = computeSchedule(at(8, 30), 100, START, END)
    expect(s.isBeforeWorkday).toBe(false)
    expect(s.shouldBeDone).toBe(0)
  })

  it('owes half the target at the midpoint of the window', () => {
    const s = computeSchedule(at(16, 15), 100, START, END)
    expect(s.shouldBeDone).toBeCloseTo(50)
    expect(s.isBeforeWorkday).toBe(false)
  })

  it('never owes more than the target late in the day', () => {
    const s = computeSchedule(at(23, 59), 100, START, END)
    expect(s.shouldBeDone).toBeLessThanOrEqual(100)
    expect(s.shouldBeDone).toBeGreaterThan(99)
  })

  it('paces toward the Daily Target only — never past the bar', () => {
    // End of day: exactly the target, regardless of what tomorrow holds.
    const s = computeSchedule(at(23, 59), 100, START, END)
    expect(s.shouldBeDone).toBeLessThanOrEqual(100)
  })

  it('respects a custom workday window', () => {
    // 9:00–17:00 window, midpoint at 13:00.
    const s = computeSchedule(at(13, 0), 100, 9 * 60, 17 * 60)
    expect(s.shouldBeDone).toBeCloseTo(50)
    // After the window ends, the full target is owed.
    expect(computeSchedule(at(20, 0), 100, 9 * 60, 17 * 60).shouldBeDone).toBe(
      100,
    )
  })
})
