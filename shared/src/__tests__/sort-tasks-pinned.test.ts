import { describe, expect, it } from 'vitest'

import { sortTasks } from '../task-sorting'
import { makeTask } from './_factories'

const today = new Date(2026, 4, 15) // 2026-05-15

describe('sortTasks — pinned float to the top', () => {
  it('ranks a pinned task above an unpinned one regardless of urgency', () => {
    const dueToday = makeTask({ id: 'urgent', due: '2026-5-15' })
    const pinnedLater = makeTask({
      id: 'pinned',
      due: '2026-6-30',
      pinned: true,
    })
    const arr = [dueToday, pinnedLater]
    sortTasks(arr, today)
    expect(arr.map((t) => t.id)).toEqual(['pinned', 'urgent'])
  })

  it('falls back to the usual rules between two pinned tasks', () => {
    const pinnedLater = makeTask({ id: 'a', due: '2026-5-20', pinned: true })
    const pinnedToday = makeTask({ id: 'b', due: '2026-5-15', pinned: true })
    const arr = [pinnedLater, pinnedToday]
    sortTasks(arr, today)
    expect(arr[0].id).toBe('b')
  })

  it('does not float a pinned task that is currently snoozed', () => {
    const future = new Date(Date.now() + 60 * 60_000).toISOString()
    const pinnedSnoozed = makeTask({
      id: 'pinned-snoozed',
      due: '2026-5-15',
      pinned: true,
      snooze: future,
    })
    const actionable = makeTask({ id: 'actionable', due: '2026-5-15' })
    const arr = [pinnedSnoozed, actionable]
    sortTasks(arr, today)
    expect(arr[0].id).toBe('actionable')
  })
})
