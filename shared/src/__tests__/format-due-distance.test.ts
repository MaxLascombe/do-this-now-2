import { describe, expect, it } from 'vitest'

import { formatDueDistance } from '../format'

describe('formatDueDistance', () => {
  it('names the day on either side of today', () => {
    expect(formatDueDistance(-1)).toBe('yesterday')
    expect(formatDueDistance(0)).toBe('today')
    expect(formatDueDistance(1)).toBe('tomorrow')
  })

  it('counts whole days into the past', () => {
    expect(formatDueDistance(-2)).toBe('2 days ago')
    expect(formatDueDistance(-30)).toBe('30 days ago')
  })

  it('counts whole days into the future', () => {
    expect(formatDueDistance(2)).toBe('in 2 days')
    expect(formatDueDistance(30)).toBe('in 30 days')
  })
})
