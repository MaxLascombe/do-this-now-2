import { describe, expect, it } from 'vitest'

import { type RepeatWeekdays } from '../task-input'
import { dateString, nextDueDate } from '../helpers'
import { makeTask } from './_factories'

// repeatWeekdays is [Su, Mo, Tu, We, Th, Fr, Sa]. 2026-5-4 is a Monday,
// so 5-6 = Wed, 5-8 = Fri, 5-11 = next Mon.
const MWF: RepeatWeekdays = [false, true, false, true, false, true, false]
const ALL: RepeatWeekdays = [true, true, true, true, true, true, true]
const NONE: RepeatWeekdays = [false, false, false, false, false, false, false]

const next = (
  due: string,
  repeatWeekdays: RepeatWeekdays,
  repeatInterval = 1,
): string | undefined => {
  const d = nextDueDate(
    makeTask({
      due,
      repeat: 'Custom',
      repeatUnit: 'week',
      repeatInterval,
      repeatWeekdays,
    }),
  )
  return d && dateString(d)
}

describe('nextDueDate — Custom weekly', () => {
  it('advances to the next selected weekday later in the same week', () => {
    expect(next('2026-5-4', MWF)).toBe('2026-5-6') // Mon → Wed
    expect(next('2026-5-6', MWF)).toBe('2026-5-8') // Wed → Fri
  })

  it('wraps to the first selected weekday of the next week', () => {
    expect(next('2026-5-8', MWF)).toBe('2026-5-11') // Fri → next Mon
  })

  it('from an unselected weekday, picks the next selected one', () => {
    expect(next('2026-5-5', MWF)).toBe('2026-5-6') // Tue → Wed
    expect(next('2026-5-10', MWF)).toBe('2026-5-11') // Sun → next Mon
  })

  it('every weekday selected advances by exactly one day (incl. Sat→Sun wrap)', () => {
    expect(next('2026-5-4', ALL)).toBe('2026-5-5') // Mon → Tue
    expect(next('2026-5-9', ALL)).toBe('2026-5-10') // Sat → Sun
  })

  it('no weekdays selected falls back to N weeks ahead', () => {
    expect(next('2026-5-1', NONE, 1)).toBe('2026-5-8')
    expect(next('2026-5-1', NONE, 2)).toBe('2026-5-15')
  })
})
