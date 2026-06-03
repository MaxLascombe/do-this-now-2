import { describe, expect, it } from 'vitest'

import { formatDueLabel } from '../format'

// formatDueLabel returns null for an unparseable `due` (archived history snapshots) — cover that defensive branch.
describe('formatDueLabel with unparseable input', () => {
  it('returns null for non-date strings', () => {
    expect(formatDueLabel('not-a-date')).toBeNull()
    expect(formatDueLabel('No Due Date')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(formatDueLabel('')).toBeNull()
  })

  it('still formats a valid due date (sanity)', () => {
    expect(formatDueLabel('2026-5-15', null, new Date(2026, 0, 1))).toMatch(
      /May/,
    )
  })
})
