import { describe, expect, it } from 'vitest'

import { getUserToday } from '../helpers'

// getUserToday brackets the user's local calendar day as a UTC half-open
// interval [todayUtcStart, tomorrowUtcStart). That interval is what the
// completed_at SQL filters use, so the boundary instants — not just the
// day key — have to be right across timezones.

describe('getUserToday UTC day boundaries', () => {
  it('brackets local midnight at UTC for offset 0', () => {
    const r = getUserToday(0, new Date('2026-06-15T12:00:00Z'))
    expect(r.todayKey).toBe('2026-6-15')
    expect(r.todayUtcStart.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(r.tomorrowUtcStart.toISOString()).toBe('2026-06-16T00:00:00.000Z')
  })

  it('uses the user-local day for a western offset near midnight', () => {
    // 04:00Z in EST (UTC-5) is still 23:00 the previous day, local.
    const r = getUserToday(300, new Date('2026-01-01T04:00:00Z'))
    expect(r.todayKey).toBe('2025-12-31')
    // Local midnight Dec 31 EST = 05:00Z; the window runs to Jan 1 05:00Z,
    // so a completion at Jan 1 02:00Z (Dec 31 21:00 local) still counts today.
    expect(r.todayUtcStart.toISOString()).toBe('2025-12-31T05:00:00.000Z')
    expect(r.tomorrowUtcStart.toISOString()).toBe('2026-01-01T05:00:00.000Z')
  })

  it('uses the user-local day for an eastern offset near midnight', () => {
    // 20:00Z in JST (UTC+9) is already 05:00 the next day, local.
    const r = getUserToday(-540, new Date('2026-06-15T20:00:00Z'))
    expect(r.todayKey).toBe('2026-6-16')
    expect(r.todayUtcStart.toISOString()).toBe('2026-06-15T15:00:00.000Z')
    expect(r.tomorrowUtcStart.toISOString()).toBe('2026-06-16T15:00:00.000Z')
  })

  it('always spans exactly 24 hours', () => {
    const r = getUserToday(300, new Date('2026-03-08T12:00:00Z'))
    const spanMs =
      r.tomorrowUtcStart.getTime() - r.todayUtcStart.getTime()
    expect(spanMs).toBe(24 * 60 * 60 * 1000)
  })
})
