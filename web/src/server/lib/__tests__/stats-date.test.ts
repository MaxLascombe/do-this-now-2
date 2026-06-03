import { describe, expect, it } from 'vitest'

import { localDateKey, localDayOfWeek, localHour } from '../stats-date'

// 2026-05-15T12:00Z is a Friday noon UTC. tzOffsetMin is minutes WEST of UTC
// (matches Date.prototype.getTimezoneOffset): +300 = EST (UTC-5), -540 = JST.
const noonUtc = Date.UTC(2026, 4, 15, 12, 0)
const earlyUtc = Date.UTC(2026, 4, 15, 2, 0) // 02:00Z

describe('localDateKey', () => {
  it('formats the user-local day without zero padding', () => {
    expect(localDateKey(Date.UTC(2026, 0, 5, 12, 0), 0)).toBe('2026-1-5')
    expect(localDateKey(noonUtc, 0)).toBe('2026-5-15')
  })

  it('rolls back to the previous local day for a western offset', () => {
    // 02:00Z minus 5h = 21:00 the day before, in EST.
    expect(localDateKey(earlyUtc, 300)).toBe('2026-5-14')
  })

  it('rolls forward to the next local day for an eastern offset', () => {
    // 20:00Z plus 9h = 05:00 next day, in JST.
    expect(localDateKey(Date.UTC(2026, 4, 15, 20, 0), -540)).toBe('2026-5-16')
  })
})

describe('localHour', () => {
  it('returns the UTC hour at offset 0', () => {
    expect(localHour(noonUtc, 0)).toBe(12)
  })

  it('shifts the hour for a western offset', () => {
    expect(localHour(noonUtc, 300)).toBe(7) // 12 - 5
  })

  it('wraps across midnight', () => {
    expect(localHour(earlyUtc, 300)).toBe(21) // 02:00Z - 5h = 21:00 prior day
  })
})

describe('localDayOfWeek', () => {
  it('reports Friday for the reference instant', () => {
    expect(localDayOfWeek(noonUtc, 0)).toBe(5)
  })

  it('reflects the day rolled back by a western offset', () => {
    expect(localDayOfWeek(earlyUtc, 300)).toBe(4) // Thursday
  })
})
