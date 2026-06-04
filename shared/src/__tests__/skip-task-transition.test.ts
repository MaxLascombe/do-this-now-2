import { describe, expect, it } from 'vitest'

import { skipTaskTransition } from '../task-transitions'
import { makeTask } from './_factories'

describe('skipTaskTransition', () => {
  it('returns null for a non-repeating task', () => {
    const task = makeTask({ repeat: 'No Repeat', due: '2026-5-1' })
    expect(skipTaskTransition(task)).toBeNull()
  })

  it('advances a daily task to the next due date', () => {
    const task = makeTask({ repeat: 'Daily', due: '2026-5-1' })
    expect(skipTaskTransition(task)?.due).toBe('2026-5-2')
  })

  it('advances a weekly task by a week', () => {
    const task = makeTask({ repeat: 'Weekly', due: '2026-5-1' })
    expect(skipTaskTransition(task)?.due).toBe('2026-5-8')
  })

  it('resets subtask done + clears stale snooze for the next occurrence', () => {
    const task = makeTask({
      repeat: 'Daily',
      due: '2026-5-1',
      subtasks: [
        { title: 'a', done: true, snooze: '2026-05-01T10:00:00.000Z' },
        { title: 'b', done: false },
      ],
    })
    const next = skipTaskTransition(task)
    expect(next?.subtasks).toEqual([
      { title: 'a', done: false, snooze: undefined },
      { title: 'b', done: false, snooze: undefined },
    ])
  })

  it('clears a task-level snooze when skipping', () => {
    const task = makeTask({
      repeat: 'Daily',
      due: '2026-5-1',
      snooze: '2026-05-01T10:00:00.000Z',
    })
    expect(skipTaskTransition(task)?.snooze).toBeNull()
  })
})
