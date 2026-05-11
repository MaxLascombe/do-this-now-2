import { describe, expect, it } from 'vitest'

import { isSnoozed, sortTasks } from '../task-sorting'
import { makeTask } from './_factories'

const today = new Date(2026, 4, 15) // 2026-05-15

describe('isSnoozed', () => {
  it('returns false when no snooze', () => {
    expect(isSnoozed(makeTask())).toBe(false)
  })

  it('returns true when snooze is in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isSnoozed(makeTask({ snooze: future }))).toBe(true)
  })

  it('returns false when snooze is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isSnoozed(makeTask({ snooze: past }))).toBe(false)
  })

  it('returns true when all subtasks are done', () => {
    expect(
      isSnoozed(
        makeTask({
          subtasks: [
            { title: 'a', done: true },
            { title: 'b', done: true },
          ],
        }),
      ),
    ).toBe(true)
  })
})

describe('sortTasks', () => {
  it('puts non-snoozed tasks before snoozed ones', () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const tasks = [
      makeTask({ id: 'snoozed', due: '2026-5-15', snooze: future }),
      makeTask({ id: 'active', due: '2026-5-15' }),
    ]
    sortTasks(tasks, today)
    expect(tasks.map((t) => t.id)).toEqual(['active', 'snoozed'])
  })

  it('puts due-today and past-due ahead of future-due', () => {
    const tasks = [
      makeTask({ id: 'future', due: '2026-5-20' }),
      makeTask({ id: 'today', due: '2026-5-15' }),
      makeTask({ id: 'past', due: '2026-5-10' }),
    ]
    sortTasks(tasks, today)
    // past + today are in the "due/past due" bucket and sort by date asc
    expect(tasks.map((t) => t.id)).toEqual(['past', 'today', 'future'])
  })

  it('strict deadlines among due-today rank ahead of non-strict', () => {
    const tasks = [
      makeTask({ id: 'lax', due: '2026-5-15' }),
      makeTask({ id: 'strict', due: '2026-5-15', strictDeadline: true }),
    ]
    sortTasks(tasks, today)
    expect(tasks.map((t) => t.id)).toEqual(['strict', 'lax'])
  })

  it('tie-breaks by due date then time frame (0 = last)', () => {
    const tasks = [
      makeTask({ id: 'no-time', due: '2026-5-15', timeFrame: 0 }),
      makeTask({ id: 'long', due: '2026-5-15', timeFrame: 90 }),
      makeTask({ id: 'short', due: '2026-5-15', timeFrame: 15 }),
    ]
    sortTasks(tasks, today)
    expect(tasks.map((t) => t.id)).toEqual(['short', 'long', 'no-time'])
  })
})
