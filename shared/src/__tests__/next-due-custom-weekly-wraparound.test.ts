import { describe, expect, it } from 'vitest'

import { dateString, nextDueDate } from '../helpers'
import { makeTask } from './_factories'

// Custom weekly picks the next selected weekday; the main suite covers the
// forward case (Mon → Wed). These pin the wraparound branch, where the next
// selected weekday falls in the following interval, not later this week.
const MWF = [false, true, false, true, false, true, false] as const

describe('nextDueDate custom-weekly wraparound', () => {
  it('advances within the week when a later selected day remains (Wed → Fri)', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-13', // Wednesday
        repeat: 'Custom',
        repeatUnit: 'week',
        repeatInterval: 1,
        repeatWeekdays: [...MWF],
      }),
    )
    expect(next && dateString(next)).toBe('2026-5-15') // Friday
  })

  it('wraps to the first selected day of the next week (Fri → Mon)', () => {
    const next = nextDueDate(
      makeTask({
        due: '2026-5-15', // Friday
        repeat: 'Custom',
        repeatUnit: 'week',
        repeatInterval: 1,
        repeatWeekdays: [...MWF],
      }),
    )
    expect(next && dateString(next)).toBe('2026-5-18') // Monday
  })
})
