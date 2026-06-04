import { describe, expect, it } from 'vitest'

import { robustChartMax } from '../heatmap'

describe('robustChartMax', () => {
  it('is 1 for an all-zero or empty series', () => {
    expect(robustChartMax([])).toBe(1)
    expect(robustChartMax([0, 0, 0])).toBe(1)
  })

  it('equals the plain max when there is no outlier', () => {
    expect(robustChartMax([1, 2, 3, 4, 5])).toBe(5)
    expect(robustChartMax([3, 3, 3, 3])).toBe(3)
  })

  it('discards a single extreme spike from the scale', () => {
    // the 50 is way outside the spread of the rest, so the axis tops out at 5
    expect(robustChartMax([1, 1, 2, 2, 3, 3, 4, 5, 50])).toBe(5)
  })

  it('ignores zeros when computing the spread', () => {
    expect(robustChartMax([0, 0, 2, 2, 3, 100])).toBeLessThan(100)
  })

  it('handles a single non-zero value', () => {
    expect(robustChartMax([0, 7, 0])).toBe(7)
  })
})
