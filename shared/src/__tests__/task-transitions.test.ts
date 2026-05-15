import { describe, expect, it } from 'vitest'

import {
  completeTaskTransition,
  snoozeTaskTransition,
  willAdvanceSubtask,
} from '../task-transitions'
import { makeTask } from './_factories'

const now = new Date('2026-05-15T12:00:00Z')

describe('willAdvanceSubtask', () => {
  it('returns false for a task with no subtasks', () => {
    expect(willAdvanceSubtask(makeTask({ subtasks: [] }), now)).toBe(false)
  })

  it('returns false when all subtasks are already done (would full-complete)', () => {
    const t = makeTask({
      subtasks: [
        { title: 'a', done: true },
        { title: 'b', done: true },
      ],
    })
    expect(willAdvanceSubtask(t, now)).toBe(false)
  })

  it('returns true when ticking off one of multiple undone subtasks', () => {
    const t = makeTask({
      subtasks: [
        { title: 'a', done: false },
        { title: 'b', done: false },
      ],
    })
    expect(willAdvanceSubtask(t, now)).toBe(true)
  })

  it('returns false when only one subtask remains undone (would full-complete)', () => {
    const t = makeTask({
      subtasks: [
        { title: 'a', done: true },
        { title: 'b', done: false },
      ],
    })
    expect(willAdvanceSubtask(t, now)).toBe(false)
  })

  it('still advances when all undone subtasks are snoozed', () => {
    const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
    const t = makeTask({
      subtasks: [
        { title: 'a', done: false, snooze: future },
        { title: 'b', done: false, snooze: future },
      ],
    })
    expect(willAdvanceSubtask(t, now)).toBe(true)
  })
})

describe('completeTaskTransition', () => {
  describe('no subtasks', () => {
    it('finish-and-delete for non-repeating task', () => {
      const t = makeTask({ repeat: 'No Repeat' })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('finish-and-delete')
      if (r.kind === 'finish-and-delete') expect(r.snapshot).toEqual(t)
    })

    it('finish-and-reschedule for repeating task', () => {
      const t = makeTask({ repeat: 'Daily', due: '2026-5-15' })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('finish-and-reschedule')
      if (r.kind === 'finish-and-reschedule') {
        expect(r.snapshot.due).toBe('2026-5-15')
        expect(r.nextTask.due).toBe('2026-5-16')
        expect(r.nextTask.updatedAt).toBe(now)
      }
    })
  })

  describe('multi-subtask task', () => {
    it('advance-subtask when more undone remain', () => {
      const t = makeTask({
        subtasks: [
          { title: 'a', done: false },
          { title: 'b', done: false },
        ],
      })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('advance-subtask')
      if (r.kind === 'advance-subtask') {
        expect(r.advanced).toBe(false)
        expect(r.nextTask.subtasks[0].done).toBe(true)
        expect(r.nextTask.subtasks[1].done).toBe(false)
        expect(r.nextTask.updatedAt).toBe(now)
      }
    })

    it('finish path when one undone subtask remains', () => {
      const t = makeTask({
        repeat: 'No Repeat',
        subtasks: [
          { title: 'a', done: true },
          { title: 'b', done: false },
        ],
      })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('finish-and-delete')
      if (r.kind === 'finish-and-delete') {
        // History snapshot reflects all-subtasks-done
        expect(r.snapshot.subtasks.every((s) => s.done)).toBe(true)
      }
    })

    it('skips snoozed subtasks when advancing', () => {
      const future = new Date(now.getTime() + 60_000).toISOString()
      const t = makeTask({
        subtasks: [
          { title: 'a', done: false, snooze: future },
          { title: 'b', done: false },
        ],
      })
      const r = completeTaskTransition(t, now)
      if (r.kind === 'advance-subtask') {
        expect(r.nextTask.subtasks[0].done).toBe(false) // snoozed, skipped
        expect(r.nextTask.subtasks[1].done).toBe(true)
      } else {
        throw new Error('expected advance-subtask')
      }
    })

    it('reschedule resets subtasks (done=false, snooze cleared)', () => {
      const future = new Date(now.getTime() + 60_000).toISOString()
      const t = makeTask({
        repeat: 'Daily',
        subtasks: [
          { title: 'a', done: true },
          { title: 'b', done: false, snooze: future },
        ],
      })
      const r = completeTaskTransition(t, now)
      if (r.kind === 'finish-and-reschedule') {
        expect(r.nextTask.subtasks.every((s) => !s.done)).toBe(true)
        expect(r.nextTask.subtasks.every((s) => s.snooze === undefined)).toBe(
          true,
        )
      } else {
        throw new Error('expected finish-and-reschedule')
      }
    })
  })
})

describe('snoozeTaskTransition', () => {
  it('snoozes the whole task when no subtasks', () => {
    const t = makeTask()
    const r = snoozeTaskTransition(t, false, now)
    expect(r.scope).toBe('task')
    expect(r.nextTask.snooze).toBe(
      new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    )
  })

  it('snoozes a single subtask when undone subtasks exist', () => {
    const t = makeTask({
      subtasks: [
        { title: 'a', done: false },
        { title: 'b', done: false },
      ],
    })
    const r = snoozeTaskTransition(t, false, now)
    expect(r.scope).toBe('subtask')
    expect(r.nextTask.subtasks[0].snooze).toBeDefined()
    expect(r.nextTask.subtasks[1].snooze).toBeUndefined()
  })

  it('snoozes whole task when allSubtasks=true even with undone subtasks', () => {
    const t = makeTask({
      subtasks: [{ title: 'a', done: false }],
    })
    const r = snoozeTaskTransition(t, true, now)
    expect(r.scope).toBe('task')
    expect(r.nextTask.snooze).toBeDefined()
  })

  it('snoozes whole task when every subtask is already done', () => {
    const t = makeTask({
      subtasks: [
        { title: 'a', done: true },
        { title: 'b', done: true },
      ],
    })
    const r = snoozeTaskTransition(t, false, now)
    expect(r.scope).toBe('task')
  })
})
