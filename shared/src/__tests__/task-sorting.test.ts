import { describe, expect, it } from 'vitest'

import {
  dueTimeHasPassed,
  findNextActionableSubtask,
  isActionableSubtask,
  isSnoozed,
  sortTasks,
  willCompletingFinishTheTask,
  willSnoozingRemoveTask,
} from '../task-sorting'
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

  describe('dueTime', () => {
    // 2026-05-15 09:00 local
    const now = new Date(2026, 4, 15, 9, 0)

    it('passed dueTime ranks above plain past-due on the same date', () => {
      const tasks = [
        makeTask({ id: 'plain', due: '2026-5-15' }),
        makeTask({ id: 'timed-passed', due: '2026-5-15', dueTime: '04:00' }),
      ]
      sortTasks(tasks, today, now)
      expect(tasks.map((t) => t.id)).toEqual(['timed-passed', 'plain'])
    })

    it('future dueTime today is NOT treated as past-due', () => {
      // 7pm task at 9am — should sort BELOW a today-due task without time.
      const tasks = [
        makeTask({ id: 'plain', due: '2026-5-15' }),
        makeTask({ id: 'timed-future', due: '2026-5-15', dueTime: '19:00' }),
      ]
      sortTasks(tasks, today, now)
      expect(tasks.map((t) => t.id)).toEqual(['plain', 'timed-future'])
    })

    it('past calendar date with dueTime still counts as past-due', () => {
      const tasks = [
        makeTask({ id: 'today', due: '2026-5-15' }),
        makeTask({ id: 'yesterday-7pm', due: '2026-5-14', dueTime: '19:00' }),
      ]
      sortTasks(tasks, today, now)
      // yesterday-7pm has passed dueTime → flag #2 fires → top
      expect(tasks.map((t) => t.id)).toEqual(['yesterday-7pm', 'today'])
    })

    it('earlier passed dueTime ranks above later passed dueTime', () => {
      // both passed by 9am; 4am ranks above 6am (longer overdue).
      const tasks = [
        makeTask({ id: 'six', due: '2026-5-15', dueTime: '06:00' }),
        makeTask({ id: 'four', due: '2026-5-15', dueTime: '04:00' }),
      ]
      sortTasks(tasks, today, now)
      expect(tasks.map((t) => t.id)).toEqual(['four', 'six'])
    })
  })
})

describe('isActionableSubtask', () => {
  const now = new Date('2026-05-15T12:00:00Z')

  it('done = not actionable', () => {
    expect(isActionableSubtask({ title: 's', done: true }, now)).toBe(false)
  })

  it('not done, no snooze = actionable', () => {
    expect(isActionableSubtask({ title: 's', done: false }, now)).toBe(true)
  })

  it('not done, snooze in the past = actionable', () => {
    expect(
      isActionableSubtask(
        { title: 's', done: false, snooze: '2026-05-14T12:00:00Z' },
        now,
      ),
    ).toBe(true)
  })

  it('not done, snooze in the future = not actionable', () => {
    expect(
      isActionableSubtask(
        { title: 's', done: false, snooze: '2026-05-16T12:00:00Z' },
        now,
      ),
    ).toBe(false)
  })
})

describe('findNextActionableSubtask', () => {
  const now = new Date('2026-05-15T12:00:00Z')

  it('empty array returns undefined', () => {
    expect(findNextActionableSubtask([], now)).toBeUndefined()
  })

  it('all done returns undefined', () => {
    expect(
      findNextActionableSubtask(
        [
          { title: 'a', done: true },
          { title: 'b', done: true },
        ],
        now,
      ),
    ).toBeUndefined()
  })

  it('returns first actionable subtask', () => {
    expect(
      findNextActionableSubtask(
        [
          { title: 'a', done: true },
          { title: 'b', done: false },
          { title: 'c', done: false },
        ],
        now,
      )?.title,
    ).toBe('b')
  })

  it('skips snoozed subtasks if non-snoozed available', () => {
    expect(
      findNextActionableSubtask(
        [
          { title: 'a', done: false, snooze: '2026-05-16T12:00:00Z' },
          { title: 'b', done: false },
        ],
        now,
      )?.title,
    ).toBe('b')
  })

  it('falls back to first not-done when all not-done are snoozed', () => {
    expect(
      findNextActionableSubtask(
        [
          { title: 'a', done: true },
          { title: 'b', done: false, snooze: '2026-05-16T12:00:00Z' },
          { title: 'c', done: false, snooze: '2026-05-17T12:00:00Z' },
        ],
        now,
      )?.title,
    ).toBe('b')
  })
})

describe('willCompletingFinishTheTask', () => {
  it('true when no subtasks (one-shot task)', () => {
    expect(willCompletingFinishTheTask(makeTask({ subtasks: [] }))).toBe(true)
  })

  it('true when exactly one undone subtask left', () => {
    expect(
      willCompletingFinishTheTask(
        makeTask({
          subtasks: [
            { title: 'a', done: true },
            { title: 'b', done: false },
          ],
        }),
      ),
    ).toBe(true)
  })

  it('false when two undone subtasks remain (THE flicker-bug case)', () => {
    expect(
      willCompletingFinishTheTask(
        makeTask({
          subtasks: [
            { title: 'a', done: false },
            { title: 'b', done: false },
          ],
        }),
      ),
    ).toBe(false)
  })

  it('true when all subtasks already done (edge — completing the last one)', () => {
    expect(
      willCompletingFinishTheTask(
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

describe('willSnoozingRemoveTask', () => {
  it('true when allSubtasks set (whole task always snoozes)', () => {
    expect(
      willSnoozingRemoveTask(
        makeTask({
          subtasks: [{ title: 'a', done: false }],
        }),
        true,
      ),
    ).toBe(true)
  })

  it('true when no subtasks (whole task snoozes)', () => {
    expect(willSnoozingRemoveTask(makeTask({ subtasks: [] }), false)).toBe(
      true,
    )
  })

  it('false when undone subtasks exist (server only snoozes one — flicker bug)', () => {
    expect(
      willSnoozingRemoveTask(
        makeTask({
          subtasks: [
            { title: 'a', done: false },
            { title: 'b', done: false },
          ],
        }),
        false,
      ),
    ).toBe(false)
  })

  it('true when all subtasks done (server snoozes whole task)', () => {
    expect(
      willSnoozingRemoveTask(
        makeTask({
          subtasks: [
            { title: 'a', done: true },
            { title: 'b', done: true },
          ],
        }),
        false,
      ),
    ).toBe(true)
  })
})

describe('dueTimeHasPassed', () => {
  it('is false when the task has no due-time', () => {
    const t = makeTask({ due: '2026-5-1', dueTime: null })
    expect(dueTimeHasPassed(t, new Date(2026, 4, 1, 23, 0))).toBe(false)
  })

  it('is false before the due-time on the due day', () => {
    const t = makeTask({ due: '2026-5-1', dueTime: '10:00' })
    expect(dueTimeHasPassed(t, new Date(2026, 4, 1, 9, 0))).toBe(false)
  })

  it('is true once the local clock reaches the due-time', () => {
    const t = makeTask({ due: '2026-5-1', dueTime: '10:00' })
    expect(dueTimeHasPassed(t, new Date(2026, 4, 1, 10, 0))).toBe(true)
    expect(dueTimeHasPassed(t, new Date(2026, 4, 1, 12, 0))).toBe(true)
  })

  it('is true on any later day', () => {
    const t = makeTask({ due: '2026-5-1', dueTime: '10:00' })
    expect(dueTimeHasPassed(t, new Date(2026, 4, 2, 8, 0))).toBe(true)
  })
})
