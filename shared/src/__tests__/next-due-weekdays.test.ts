import { describe, expect, it } from 'vitest'

import { dateString, nextDueDate } from '../helpers'

import { makeTask } from './_factories'

// 2026-5-1 is a Friday, so 5-2 = Sat, 5-3 = Sun, 5-4 = Mon, 5-7 = Thu, 5-8 = Fri.
const nextWeekday = (due: string) =>
  nextDueDate(makeTask({ due, repeat: 'Weekdays' }))

describe('nextDueDate Weekdays skips weekends from any starting day', () => {
  it('Mon → Tue', () => {
    expect(dateString(nextWeekday('2026-5-4')!)).toBe('2026-5-5')
  })

  it('Thu → Fri', () => {
    expect(dateString(nextWeekday('2026-5-7')!)).toBe('2026-5-8')
  })

  it('Fri → Mon', () => {
    expect(dateString(nextWeekday('2026-5-1')!)).toBe('2026-5-4')
  })

  it('Sat → Mon (does not stop on Sunday)', () => {
    expect(dateString(nextWeekday('2026-5-2')!)).toBe('2026-5-4')
  })

  it('Sun → Mon', () => {
    expect(dateString(nextWeekday('2026-5-3')!)).toBe('2026-5-4')
  })
})
