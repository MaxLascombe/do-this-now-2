import { describe, expect, it } from 'vitest'

import {
  dateString,
  getUserLocalNow,
  getUserToday,
  newSafeDate,
  newSafeDateTime,
  nextDueDate,
  repeatFrequencyDays,
} from '../helpers'
import { makeTask } from './_factories'

describe('newSafeDate', () => {
  it('parses YYYY-M-D into local-midnight Date', () => {
    const d = newSafeDate('2026-3-5')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // March
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(0)
  })

  it('round-trips through dateString', () => {
    const d = newSafeDate('2026-12-31')
    expect(dateString(d)).toBe('2026-12-31')
  })
})

describe('dateString', () => {
  it('emits YYYY-M-D without zero-padding', () => {
    expect(dateString(new Date(2026, 0, 1))).toBe('2026-1-1')
    expect(dateString(new Date(2026, 11, 31))).toBe('2026-12-31')
  })
})

describe('nextDueDate', () => {
  it('returns undefined for No Repeat tasks', () => {
    expect(nextDueDate(makeTask({ due: '2026-5-1', repeat: 'No Repeat' })))
      .toBeUndefined()
  })

  it('Daily → +1 day', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-1', repeat: 'Daily' }))
    expect(next && dateString(next)).toBe('2026-5-2')
  })

  it('Weekly → +7 days', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-1', repeat: 'Weekly' }))
    expect(next && dateString(next)).toBe('2026-5-8')
  })

  it('Weekdays: Mon (2026-5-4) → Tue', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-4', repeat: 'Weekdays' }))
    expect(next && dateString(next)).toBe('2026-5-5')
  })

  it('Weekdays: Fri (2026-5-1) → Mon (skip weekend)', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-1', repeat: 'Weekdays' }))
    expect(next && dateString(next)).toBe('2026-5-4')
  })

  it('Monthly → +1 month, same day', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-15', repeat: 'Monthly' }))
    expect(next && dateString(next)).toBe('2026-6-15')
  })

  it('Yearly → same date next year', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-15', repeat: 'Yearly' }))
    expect(next && dateString(next)).toBe('2027-5-15')
  })

  it('Custom every N days', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-1',
        repeat: 'Custom',
        repeatUnit: 'day',
        repeatInterval: 3,
      }),
    )
    expect(next && dateString(next)).toBe('2026-5-4')
  })

  it('Custom every 2 weeks with no weekdays selected falls back to +14d', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-1',
        repeat: 'Custom',
        repeatUnit: 'week',
        repeatInterval: 2,
      }),
    )
    expect(next && dateString(next)).toBe('2026-5-15')
  })

  it('Custom weekly on M/W/F: from Mon → Wed', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-4', // Monday
        repeat: 'Custom',
        repeatUnit: 'week',
        repeatInterval: 1,
        repeatWeekdays: [false, true, false, true, false, true, false],
      }),
    )
    expect(next && dateString(next)).toBe('2026-5-6')
  })

  it('Custom every N months', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-1',
        repeat: 'Custom',
        repeatUnit: 'month',
        repeatInterval: 3,
      }),
    )
    expect(next && dateString(next)).toBe('2026-8-1')
  })

  it('Custom every N years', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-1',
        repeat: 'Custom',
        repeatUnit: 'year',
        repeatInterval: 2,
      }),
    )
    expect(next && dateString(next)).toBe('2028-5-1')
  })
})

describe('getUserToday', () => {
  it('with tzOffsetMin=0 returns server-local today', () => {
    const result = getUserToday(0, new Date('2026-05-15T14:30:00Z'))
    expect(result.todayKey).toBe('2026-5-15')
  })

  it('EST (offsetMin=300) at 2025-12-31 23:00 UTC is still 2025-12-31 user-local', () => {
    // 23:00 UTC - 5h = 18:00 EST same day
    const result = getUserToday(300, new Date('2025-12-31T23:00:00Z'))
    expect(result.todayKey).toBe('2025-12-31')
  })

  it('EST at 2026-01-01 04:00 UTC is still 2025-12-31 user-local', () => {
    // 04:00 UTC - 5h = 23:00 EST previous day
    const result = getUserToday(300, new Date('2026-01-01T04:00:00Z'))
    expect(result.todayKey).toBe('2025-12-31')
  })
})

describe('newSafeDateTime', () => {
  it('combines YYYY-M-D and HH:MM into a local Date', () => {
    const d = newSafeDateTime('2026-3-5', '14:30')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // March
    expect(d.getDate()).toBe(5)
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
  })

  it('handles midnight', () => {
    const d = newSafeDateTime('2026-12-31', '00:00')
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getDate()).toBe(31)
  })
})

describe('getUserLocalNow', () => {
  it('returns wall-clock fields unchanged for a UTC user', () => {
    const d = getUserLocalNow(0, new Date('2026-05-01T15:30:00Z'))
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(4)
    expect(d.getDate()).toBe(1)
    expect(d.getHours()).toBe(15)
    expect(d.getMinutes()).toBe(30)
  })

  it('rolls the date back when the user is behind UTC across midnight', () => {
    // EST (tzOffsetMin 300): 02:00Z is still the previous evening locally.
    const d = getUserLocalNow(300, new Date('2026-05-01T02:00:00Z'))
    expect(d.getMonth()).toBe(3) // April
    expect(d.getDate()).toBe(30)
    expect(d.getHours()).toBe(21)
  })

  it('rolls the date forward when the user is ahead of UTC', () => {
    // UTC+5 (tzOffsetMin -300): 22:00Z is already past local midnight.
    const d = getUserLocalNow(-300, new Date('2026-05-01T22:00:00Z'))
    expect(d.getDate()).toBe(2)
    expect(d.getHours()).toBe(3)
  })
})

describe('repeatFrequencyDays', () => {
  it('returns Infinity for non-repeating tasks', () => {
    expect(repeatFrequencyDays(makeTask({ repeat: 'No Repeat' }))).toBe(Infinity)
  })

  it('handles the fixed cadences', () => {
    expect(repeatFrequencyDays(makeTask({ repeat: 'Daily' }))).toBe(1)
    expect(repeatFrequencyDays(makeTask({ repeat: 'Weekdays' }))).toBe(7 / 5)
    expect(repeatFrequencyDays(makeTask({ repeat: 'Weekly' }))).toBe(7)
    expect(repeatFrequencyDays(makeTask({ repeat: 'Monthly' }))).toBe(30)
    expect(repeatFrequencyDays(makeTask({ repeat: 'Yearly' }))).toBe(365)
  })

  it('Custom day uses the interval directly', () => {
    expect(
      repeatFrequencyDays(
        makeTask({ repeat: 'Custom', repeatUnit: 'day', repeatInterval: 3 }),
      ),
    ).toBe(3)
  })

  it('Custom week divides 7*interval by the number of selected weekdays', () => {
    expect(
      repeatFrequencyDays(
        makeTask({
          repeat: 'Custom',
          repeatUnit: 'week',
          repeatInterval: 1,
          repeatWeekdays: [false, true, false, true, false, true, false], // M/W/F
        }),
      ),
    ).toBe(7 / 3)

    expect(
      repeatFrequencyDays(
        makeTask({
          repeat: 'Custom',
          repeatUnit: 'week',
          repeatInterval: 2,
          repeatWeekdays: [true, false, false, false, false, false, true],
        }),
      ),
    ).toBe((7 * 2) / 2)
  })

  it('Custom week with no weekdays selected falls back to 7*interval', () => {
    expect(
      repeatFrequencyDays(
        makeTask({
          repeat: 'Custom',
          repeatUnit: 'week',
          repeatInterval: 2,
          repeatWeekdays: [false, false, false, false, false, false, false],
        }),
      ),
    ).toBe(14)
  })

  it('Custom month/year scale by interval', () => {
    expect(
      repeatFrequencyDays(
        makeTask({ repeat: 'Custom', repeatUnit: 'month', repeatInterval: 2 }),
      ),
    ).toBe(60)
    expect(
      repeatFrequencyDays(
        makeTask({ repeat: 'Custom', repeatUnit: 'year', repeatInterval: 1 }),
      ),
    ).toBe(365)
  })
})
