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
    // 2026-5-15 was a Friday
    expect(formatDueLabel('2026-5-15')).toMatch(/^Fri May 15$/)
  })

  it('renders time-of-day instead of "Today" when dueTime is set today', () => {
    const t = new Date()
    const s = `${t.getFullYear()}-${t.getMonth() + 1}-${t.getDate()}`
    expect(formatDueLabel(s, '04:00')).toBe('4:00 AM')
    expect(formatDueLabel(s, '19:30')).toBe('7:30 PM')
  })

  it('ignores dueTime when not due today (date wins)', () => {
    // 2026-5-15 was a Friday
    expect(formatDueLabel('2026-5-15', '07:00')).toMatch(/^Fri May 15$/)
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
    ).toBe('0h30 behind of schedule')
  })

  it('short mode drops " of schedule"', () => {
    expect(
      formatScheduleStatus({
        done: 90,
        shouldBeDone: 60,
        isBeforeWorkday: false,
        short: true,
      }),
    ).toBe('0h30 ahead')
  })
})
