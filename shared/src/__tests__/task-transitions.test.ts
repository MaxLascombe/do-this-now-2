import { describe, expect, it } from 'vitest'

import {
  applyFullCompletion,
  completeTaskTransition,
  snoozeTaskTransition,
  willAdvanceSubtask,
} from '../task-transitions'
import { isSnoozed } from '../task-sorting'
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

    it('completing the last actionable subtask leaves the task snoozed (so the timer banks)', () => {
      // Others are snoozed/done; only `b` is actionable. Completing it
      // should leave the task with nothing actionable — `isSnoozed` is the
      // predicate completeTask/optimisticComplete use to pause the timer.
      // `isSnoozed` reads the real wall-clock, so use a far-future snooze
      // that's still in the future regardless of when the suite runs.
      const t = makeTask({
        subtasks: [
          { title: 'a', done: true },
          { title: 'b', done: false },
          { title: 'c', done: false, snooze: '2099-01-01T00:00:00Z' },
        ],
      })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('advance-subtask')
      if (r.kind === 'advance-subtask') {
        expect(isSnoozed(r.nextTask)).toBe(true)
      }
    })

    it('completing a subtask with other actionable ones left is NOT snoozed (timer keeps running)', () => {
      const t = makeTask({
        subtasks: [
          { title: 'a', done: false },
          { title: 'b', done: false },
        ],
      })
      const r = completeTaskTransition(t, now)
      expect(r.kind).toBe('advance-subtask')
      if (r.kind === 'advance-subtask') {
        expect(isSnoozed(r.nextTask)).toBe(false)
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

describe('applyFullCompletion', () => {
  const base = { actualSeconds: 600, now }

  it('clamps negative actualSeconds to 0', () => {
    const t = makeTask({ timeFrame: 10, timeframeType: 'fluid' })
    const r = applyFullCompletion({ task: t, actualSeconds: -50, now })
    expect(r.actualSecondsPerRow).toBe(0)
  })

  describe('timekeeper child / zero time frame', () => {
    it('one-shot: 1 completion, no credit, deletes', () => {
      const t = makeTask({ timeFrame: 0, timekeeperId: 'keeper-1' })
      const r = applyFullCompletion({ task: t, ...base })
      expect(r).toMatchObject({
        completions: 1,
        actualSecondsPerRow: 0,
        carryoverSeconds: 0,
        nextTask: null,
      })
    })

    it('repeating: reschedules with reset subtasks, no credit', () => {
      const t = makeTask({
        timeFrame: 0,
        timekeeperId: 'keeper-1',
        repeat: 'Daily',
        due: '2026-5-1',
        subtasks: [{ title: 'a', done: true }],
      })
      const r = applyFullCompletion({ task: t, ...base })
      expect(r.completions).toBe(1)
      expect(r.actualSecondsPerRow).toBe(0)
      expect(r.nextTask?.due).toBe('2026-5-2')
      expect(r.nextTask?.subtasks[0].done).toBe(false)
    })
  })

  describe('fluid', () => {
    it('one-shot: credits full session and deletes', () => {
      const t = makeTask({ timeFrame: 10, timeframeType: 'fluid' })
      const r = applyFullCompletion({ task: t, actualSeconds: 900, now })
      expect(r).toMatchObject({
        completions: 1,
        actualSecondsPerRow: 900,
        nextTask: null,
      })
    })

    it('first measurement (n=0) seeds the time frame from actual', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fluid',
        measurementCount: 0,
        repeat: 'Daily',
        due: '2026-5-1',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 1200, now })
      expect(r.nextTask?.timeFrame).toBe(20)
      expect(r.nextTask?.measurementCount).toBe(1)
      expect(r.nextTask?.timerAccumulatedSeconds).toBe(0)
      expect(r.nextTask?.due).toBe('2026-5-2')
    })

    it('running average while n<14', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fluid',
        measurementCount: 1,
        repeat: 'Daily',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 1200, now })
      expect(r.nextTask?.timeFrame).toBe(15) // (10*1 + 20) / 2
      expect(r.nextTask?.measurementCount).toBe(2)
    })

    it('EMA (13/14) once n>=14 and caps measurementCount at 14', () => {
      const t = makeTask({
        timeFrame: 14,
        timeframeType: 'fluid',
        measurementCount: 14,
        repeat: 'Daily',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 1680, now })
      expect(r.nextTask?.timeFrame).toBe(15) // (14*13 + 28) / 14
      expect(r.nextTask?.measurementCount).toBe(14)
    })

    it('countMeasurement=false leaves the estimate untouched', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fluid',
        measurementCount: 3,
        repeat: 'Daily',
      })
      const r = applyFullCompletion({
        task: t,
        actualSeconds: 9999,
        now,
        countMeasurement: false,
      })
      expect(r.nextTask?.timeFrame).toBe(10)
      expect(r.nextTask?.measurementCount).toBe(3)
    })
  })

  describe('fixed', () => {
    it('one-shot: 1 row crediting the full session, deletes', () => {
      const t = makeTask({ timeFrame: 10, timeframeType: 'fixed' })
      const r = applyFullCompletion({ task: t, actualSeconds: 720, now })
      expect(r).toMatchObject({
        completions: 1,
        actualSecondsPerRow: 720,
        carryoverSeconds: 0,
        nextTask: null,
      })
    })

    it('repeating exactly at target: 1 completion, no carryover', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fixed',
        repeat: 'Daily',
        due: '2026-5-1',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 600, now })
      expect(r.completions).toBe(1)
      expect(r.actualSecondsPerRow).toBe(600)
      expect(r.carryoverSeconds).toBe(0)
      expect(r.nextTask?.due).toBe('2026-5-2')
      expect(r.nextTask?.timerAccumulatedSeconds).toBe(0)
    })

    it('repeating over target: floors completions and carries the remainder', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fixed',
        repeat: 'Daily',
        due: '2026-5-1',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 1500, now })
      expect(r.completions).toBe(2) // floor(1500 / 600)
      expect(r.actualSecondsPerRow).toBe(600)
      expect(r.carryoverSeconds).toBe(300) // 1500 - 2*600
      expect(r.nextTask?.due).toBe('2026-5-3') // advanced twice
      expect(r.nextTask?.timerAccumulatedSeconds).toBe(300)
    })

    it('repeating below target: still credits 1 (server defends direct hits)', () => {
      const t = makeTask({
        timeFrame: 10,
        timeframeType: 'fixed',
        repeat: 'Daily',
        due: '2026-5-1',
      })
      const r = applyFullCompletion({ task: t, actualSeconds: 60, now })
      expect(r.completions).toBe(1)
      expect(r.carryoverSeconds).toBe(0)
      expect(r.nextTask?.due).toBe('2026-5-2')
    })
  })
})
