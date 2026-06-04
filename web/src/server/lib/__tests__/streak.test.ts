import { describe, expect, it } from 'vitest'

import { computeLongestStreak } from '../streak'

describe('computeLongestStreak', () => {
  it('is 0 for no hit days', () => {
    expect(computeLongestStreak([])).toBe(0)
  })

  it('is 1 for a single day', () => {
    expect(computeLongestStreak(['2026-5-1'])).toBe(1)
  })

  it('counts a run of consecutive days', () => {
    expect(computeLongestStreak(['2026-5-1', '2026-5-2', '2026-5-3'])).toBe(3)
  })

  it('resets the run across a gap and keeps the longest', () => {
    // run of 3, gap, then run of 2 → longest is 3
    const dates = [
      '2026-5-1',
      '2026-5-2',
      '2026-5-3',
      '2026-5-5',
      '2026-5-6',
    ]
    expect(computeLongestStreak(dates)).toBe(3)
  })

  it('does not depend on input order', () => {
    expect(computeLongestStreak(['2026-5-3', '2026-5-1', '2026-5-2'])).toBe(3)
  })

  it('counts a run across a month boundary', () => {
    expect(computeLongestStreak(['2026-5-31', '2026-6-1', '2026-6-2'])).toBe(3)
  })

  it('counts a run across a year boundary', () => {
    expect(computeLongestStreak(['2025-12-31', '2026-1-1'])).toBe(2)
  })
})
