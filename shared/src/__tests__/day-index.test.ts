import { describe, expect, it } from 'vitest'

import { dayIndex } from '../day-index'

describe('dayIndex', () => {
  const now = new Date(2026, 4, 15, 9, 30) // May 15 2026, mid-morning

  it('is 0 for today regardless of time of day', () => {
    expect(dayIndex(new Date(2026, 4, 15, 23, 59), now)).toBe(0)
    expect(dayIndex(new Date(2026, 4, 15, 0, 0), now)).toBe(0)
  })

  it('is 1 for tomorrow and -1 for yesterday', () => {
    expect(dayIndex(new Date(2026, 4, 16), now)).toBe(1)
    expect(dayIndex(new Date(2026, 4, 14), now)).toBe(-1)
  })

  it('counts calendar days for overdue and future dates', () => {
    expect(dayIndex(new Date(2026, 4, 10), now)).toBe(-5)
    expect(dayIndex(new Date(2026, 4, 22), now)).toBe(7)
  })

  it('counts across a month boundary', () => {
    // May 15 → Jun 1 is 17 days (May has 31 days).
    expect(dayIndex(new Date(2026, 5, 1), now)).toBe(17)
  })
})
