import { describe, expect, it } from 'vitest'

import { heatmapColor, percentile } from '../heatmap'

describe('percentile', () => {
  it('is 0 for an empty array', () => {
    expect(percentile([], 50)).toBe(0)
  })

  it('returns the value at the p-th position of a sorted array', () => {
    const sorted = [10, 20, 30, 40, 50]
    expect(percentile(sorted, 0)).toBe(10)
    expect(percentile(sorted, 50)).toBe(30)
    expect(percentile(sorted, 100)).toBe(50)
  })

  it('clamps the index within bounds', () => {
    expect(percentile([5], 99)).toBe(5)
    expect(percentile([1, 2], 66)).toBe(1)
  })
})

describe('heatmapColor', () => {
  it('is faint for zero-minute days', () => {
    expect(heatmapColor(0, false, 10, 20)).toBe('rgba(255,255,255,0.04)')
    // zero wins even if the day "hit" with no recorded minutes
    expect(heatmapColor(0, true, 10, 20)).toBe('rgba(255,255,255,0.04)')
  })

  it('is the accent for target-hit or top-tier days', () => {
    expect(heatmapColor(5, true, 10, 20)).toBe('#34d399')
    expect(heatmapColor(25, false, 10, 20)).toBe('#34d399') // >= p66
  })

  it('uses the mid tier at/above p33', () => {
    expect(heatmapColor(15, false, 10, 20)).toBe('#059669') // p33 <= m < p66
  })

  it('uses the low tier below p33', () => {
    expect(heatmapColor(5, false, 10, 20)).toBe('#065f46')
  })
})
