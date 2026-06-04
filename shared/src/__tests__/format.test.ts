import { describe, expect, it } from 'vitest'

import {
  formatDueLabel,
  formatRepeat,
  formatScheduleStatus,
} from '../format'

describe('formatRepeat', () => {
  it('returns null for No Repeat', () => {
    expect(formatRepeat('No Repeat', 1, 'day', [
      false, false, false, false, false, false, false,
    ])).toBeNull()
  })

  it('returns lowercase enum value for standard repeats', () => {
    expect(formatRepeat('Daily', 1, 'day', [
      false, false, false, false, false, false, false,
    ])).toBe('daily')
    expect(formatRepeat('Weekly', 1, 'day', [
      false, false, false, false, false, false, false,
    ])).toBe('weekly')
  })

  it('formats Custom singular as Nly', () => {
    expect(formatRepeat('Custom', 1, 'day', [
      false, false, false, false, false, false, false,
    ])).toBe('daily')
  })

  it('formats Custom plural with count', () => {
    expect(formatRepeat('Custom', 3, 'week', [
      false, false, false, false, false, false, false,
    ])).toBe('3 weeks')
  })

  it('appends selected weekdays for custom weekly', () => {
    expect(
      formatRepeat('Custom', 1, 'week', [
        false, true, false, true, false, true, false,
      ]),
    ).toBe('weekly: mo, we, fr')
  })
})

describe('formatDueLabel', () => {
  it('returns "Today" for today', () => {
    const t = new Date()
    const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
    expect(formatDueLabel(s)).toBe('Today')
  })

  it('returns "Tomorrow"', () => {
    const t = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
    expect(formatDueLabel(s)).toBe('Tomorrow')
  })

  it('returns "Yesterday"', () => {
    const t = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
    expect(formatDueLabel(s)).toBe('Yesterday')
  })

  it('formats other dates as iii LLL d', () => {
    // 2026-5-15 was a Friday. Inject a fixed "today" reference so the
    // assertion doesn't drift into Today/Tomorrow/Yesterday as the
    // wall-clock crosses these dates.
    expect(formatDueLabel('2026-5-15', null, new Date(2026, 0, 1))).toMatch(
      /^Fri May 15$/,
    )
  })

  it('renders time-of-day instead of "Today" when dueTime is set today', () => {
    const t = new Date()
    const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
    expect(formatDueLabel(s, '04:00')).toBe('4:00 AM')
    expect(formatDueLabel(s, '19:30')).toBe('7:30 PM')
  })

  it('ignores dueTime when not due today (date wins)', () => {
    // 2026-5-15 was a Friday — pin "today" so the test stays stable.
    expect(
      formatDueLabel('2026-5-15', '07:00', new Date(2026, 0, 1)),
    ).toMatch(/^Fri May 15$/)
  })

  it('detects Tomorrow/Yesterday across a month boundary', () => {
    const jan31 = new Date(2026, 0, 31)
    expect(formatDueLabel('2026-2-1', null, jan31)).toBe('Tomorrow')
    const feb1 = new Date(2026, 1, 1)
    expect(formatDueLabel('2026-1-31', null, feb1)).toBe('Yesterday')
  })

  it('detects Tomorrow/Yesterday across a year boundary', () => {
    const dec31 = new Date(2025, 11, 31)
    expect(formatDueLabel('2026-1-1', null, dec31)).toBe('Tomorrow')
    const jan1 = new Date(2026, 0, 1)
    expect(formatDueLabel('2025-12-31', null, jan1)).toBe('Yesterday')
  })
})

describe('formatScheduleStatus', () => {
  it('returns "Ahead of schedule" before workday with diff 0', () => {
    expect(
      formatScheduleStatus({
        done: 0,
        shouldBeDone: 0,
        isBeforeWorkday: true,
      }),
    ).toBe('Ahead of schedule')
  })

  it('returns "On schedule" during workday with diff 0', () => {
    expect(
      formatScheduleStatus({
        done: 100,
        shouldBeDone: 100,
        isBeforeWorkday: false,
      }),
    ).toBe('On schedule')
  })

  // minutesToHours uses an Xh[Y] format where Y is two-digit minutes when
  // present. 30 minutes → "0h30", 90 → "1h30", 60 → "1h".
  it('reports minutes ahead', () => {
    expect(
      formatScheduleStatus({
        done: 90,
        shouldBeDone: 60,
        isBeforeWorkday: false,
      }),
    ).toBe('0h30 ahead of schedule')
  })

  it('reports minutes behind', () => {
    expect(
      formatScheduleStatus({
        done: 30,
        shouldBeDone: 60,
        isBeforeWorkday: false,
      }),
    ).toBe('0h30 behind schedule')
  })

  it('short mode drops the schedule suffix', () => {
    expect(
      formatScheduleStatus({
        done: 90,
        shouldBeDone: 60,
        isBeforeWorkday: false,
        short: true,
      }),
    ).toBe('0h30 ahead')
    expect(
      formatScheduleStatus({
        done: 30,
        shouldBeDone: 60,
        isBeforeWorkday: false,
        short: true,
      }),
    ).toBe('0h30 behind')
  })
})
