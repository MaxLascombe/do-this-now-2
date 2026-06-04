import { describe, expect, it } from 'vitest'

import { computePoints } from '../scoring'

describe('computePoints', () => {
  it('is 0 when nothing is done', () => {
    expect(computePoints(0, 100, 20)).toBe(0)
  })

  it('scores minutes covered by lives at 1x', () => {
    // todo 100, lives 20 → first 80 min are "all lives" (1x), next 20 are 2x.
    // done 80 → all within the 1x band.
    expect(computePoints(80, 100, 20)).toBe(80)
  })

  it('scores minutes within target (above the lives band) at 2x', () => {
    // done 100: 80 @1x + 20 @2x = 80 + 40 = 120.
    expect(computePoints(100, 100, 20)).toBe(120)
  })

  it('scores minutes beyond target at 3x', () => {
    // done 130: 80 @1x + 20 @2x + 30 @3x = 80 + 40 + 90 = 210.
    expect(computePoints(130, 100, 20)).toBe(210)
  })

  it('handles zero lives (no 2x cushion band)', () => {
    // lives 0 → the 2x cushion [todo-lives, todo] is empty, so the whole
    // target is the 1x band: done 100 → 100 @1x = 100.
    expect(computePoints(100, 100, 0)).toBe(100)
  })
})
