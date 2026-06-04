import { describe, expect, it } from 'vitest'

import {
  findNextActionableSubtask,
  isActionableSubtask,
} from '../task-sorting'

const now = new Date('2026-05-15T12:00:00Z')

// isActionableSubtask uses a strict `<` against `now`, so a subtask whose
// snooze expires at exactly the current instant is still treated as snoozed.
// This is the single source of truth for the home-screen subtask picker, so
// pin the boundary explicitly.
describe('isActionableSubtask snooze-expiry boundary', () => {
  it('treats a snooze landing exactly on now as still snoozed', () => {
    expect(
      isActionableSubtask(
        { title: 's', done: false, snooze: '2026-05-15T12:00:00Z' },
        now,
      ),
    ).toBe(false)
  })

  it('treats a snooze one millisecond in the past as actionable', () => {
    expect(
      isActionableSubtask(
        { title: 's', done: false, snooze: '2026-05-15T11:59:59.999Z' },
        now,
      ),
    ).toBe(true)
  })

  it('falls back to the first not-done subtask when all are snoozed at the boundary', () => {
    const next = findNextActionableSubtask(
      [
        { title: 'done', done: true },
        { title: 'snoozed-now', done: false, snooze: '2026-05-15T12:00:00Z' },
      ],
      now,
    )
    expect(next?.title).toBe('snoozed-now')
  })
})
