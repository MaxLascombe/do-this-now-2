import { describe, expect, it } from 'vitest'

import { sortTasks } from '../task-sorting'
import { makeTask } from './_factories'

const today = new Date(2026, 4, 15) // 2026-05-15 (Fri)
const now = new Date(2026, 4, 15, 12, 0)

// Among tasks that are otherwise tied (all due today, not snoozed, no
// dueTime, non-strict), the recurrence-priority flag ranks the ones whose
// completion keeps them away longest first: a task that won't return for at
// least two days outranks one that comes back tomorrow.
describe('sortTasks recurrence priority', () => {
  it('ranks a one-shot due today above a daily due today', () => {
    const tasks = [
      makeTask({ id: 'daily', due: '2026-5-15', repeat: 'Daily' }),
      makeTask({ id: 'oneshot', due: '2026-5-15', repeat: 'No Repeat' }),
    ]
    sortTasks(tasks, today, now)
    expect(tasks.map((t) => t.id)).toEqual(['oneshot', 'daily'])
  })

  it('ranks a weekly due today above a daily due today', () => {
    const tasks = [
      makeTask({ id: 'daily', due: '2026-5-15', repeat: 'Daily' }),
      makeTask({ id: 'weekly', due: '2026-5-15', repeat: 'Weekly' }),
    ]
    sortTasks(tasks, today, now)
    expect(tasks.map((t) => t.id)).toEqual(['weekly', 'daily'])
  })
})
