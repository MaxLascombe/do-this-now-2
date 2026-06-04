import { describe, expect, it } from 'vitest'

import { formatDaysAgo } from '../format'

describe('formatDaysAgo', () => {
  it("renders 'today' at zero", () => {
    expect(formatDaysAgo(0)).toBe('today')
  })

  it("singularizes one day as '1 day ago'", () => {
    expect(formatDaysAgo(1)).toBe('1 day ago')
  })

  it('pluralizes for two or more days', () => {
    expect(formatDaysAgo(2)).toBe('2 days ago')
    expect(formatDaysAgo(30)).toBe('30 days ago')
  })
})
