import { describe, expect, it } from 'vitest'

import { dateString, nextDueDate } from '../helpers'
import { makeTask } from './_factories'

// The Weekdays branch skips Sat/Sun from any starting day. The main suite
// covers Mon → Tue and Fri → Mon; pin the weekend-start cases (the scenario
// the do-while loop fixed) so both roll forward to Monday.
describe('nextDueDate Weekdays from a weekend day', () => {
  it('Saturday → Monday', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-2', repeat: 'Weekdays' }))
    expect(next && dateString(next)).toBe('2026-5-4')
  })

  it('Sunday → Monday', () => {
    const next = nextDueDate(makeTask({ due: '2026-5-3', repeat: 'Weekdays' }))
    expect(next && dateString(next)).toBe('2026-5-4')
  })
})
