import { describe, expect, it } from 'vitest'

import { formatDueLabel } from '../format'

// dueTime is only rendered when the due date is today — it's checked inside the
// `today` branch, so Tomorrow/Yesterday/other dates show their label, not a time.
describe('formatDueLabel dueTime scope', () => {
  const today = new Date(2026, 4, 15) // May 15 2026

  it('shows the time when the due date is today', () => {
    expect(formatDueLabel('2026-5-15', '14:00', today)).toBe('2:00 PM')
  })

  it('ignores dueTime for tomorrow and yesterday', () => {
    expect(formatDueLabel('2026-5-16', '14:00', today)).toBe('Tomorrow')
    expect(formatDueLabel('2026-5-14', '14:00', today)).toBe('Yesterday')
  })

  it('ignores dueTime for a further-out date', () => {
    expect(formatDueLabel('2026-5-20', '09:30', today)).toMatch(/May/)
  })
})
