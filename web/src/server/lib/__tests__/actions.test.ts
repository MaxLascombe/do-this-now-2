import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  dailyProgress,
  history,
  taskEvents,
  tasks,
  userState,
} from '@dtn/shared/schema'

import { db } from '../../../db'
import { completeTask, snoozeManyTasks, snoozeTask } from '../actions'
import { applyTimerAction } from '../timer'

// Integration tests that hit a real Neon Postgres via the neon-serverless
// driver. Skipped automatically in CI (where DATABASE_URL isn't set).
//
// Each test runs against a dedicated TEST_USER namespace and cleans up all
// rows for that user before/after — safe to co-exist with prod data on the
// same DB.

const TEST_USER = 'user_vitest_integration'
const BOGUS_UUID = '00000000-0000-4000-8000-000000000000'

async function cleanupTestUser() {
  await db.delete(taskEvents).where(eq(taskEvents.userId, TEST_USER))
  await db.delete(history).where(eq(history.userId, TEST_USER))
  await db.delete(userState).where(eq(userState.userId, TEST_USER))
  await db.delete(tasks).where(eq(tasks.userId, TEST_USER))
  await db.delete(dailyProgress).where(eq(dailyProgress.userId, TEST_USER))
}

type TaskOverrides = Partial<{
  title: string
  emoji: string
  due: string
  repeat:
    | 'No Repeat'
    | 'Daily'
    | 'Weekdays'
    | 'Weekly'
    | 'Monthly'
    | 'Yearly'
    | 'Custom'
  repeatInterval: number
  repeatUnit: 'day' | 'week' | 'month' | 'year'
  timeFrame: number
  subtasks: Array<{ title: string; done: boolean; snooze?: string }>
}>

async function makeTask(over: TaskOverrides = {}) {
  const [row] = await db
    .insert(tasks)
    .values({
      userId: TEST_USER,
      title: over.title ?? 'Integration test task',
      emoji: over.emoji ?? '✅',
      due: over.due ?? '2026-5-12',
      repeat: over.repeat ?? 'No Repeat',
      repeatInterval: over.repeatInterval ?? 1,
      repeatUnit: over.repeatUnit ?? 'day',
      timeFrame: over.timeFrame ?? 30,
      subtasks: over.subtasks ?? [],
    })
    .returning()
  return row
}

describe.skipIf(!process.env.DATABASE_URL)('actions (integration)', () => {
  beforeEach(cleanupTestUser)
  afterAll(cleanupTestUser)

  // -------------------------------------------------------------------
  // Regression tests for the neon-http vs neon-serverless driver swap
  // (https://… "No transactions support in neon-http driver")
  // -------------------------------------------------------------------
  describe('regression: db.transaction works with the configured driver', () => {
    it('completeTask reaches the transaction body (throws Task not found on bogus id, NOT a driver error)', async () => {
      await expect(completeTask(TEST_USER, BOGUS_UUID, 300)).rejects.toThrow(
        'Task not found',
      )
    })

    it('snoozeTask reaches the transaction body (throws Task not found on bogus id, NOT a driver error)', async () => {
      await expect(snoozeTask(TEST_USER, BOGUS_UUID, false)).rejects.toThrow(
        'Task not found',
      )
    })
  })

  // -------------------------------------------------------------------
  // E2E: full create → action → assert DB state → repeat
  // -------------------------------------------------------------------
  describe('completeTask', () => {
    it('inserts a history row and deletes a one-shot task', async () => {
      const task = await makeTask({ repeat: 'No Repeat' })
      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: true })

      const remaining = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(remaining).toHaveLength(0)

      const hist = await db
        .select()
        .from(history)
        .where(eq(history.userId, TEST_USER))
      expect(hist).toHaveLength(1)
      expect(hist[0].taskSnapshot.title).toBe('Integration test task')
      // history.taskId is ON DELETE SET NULL by design (batch C). For a
      // deleted one-shot task, the FK is nulled out but taskSnapshot
      // preserves everything needed to render the history row.
      expect(hist[0].taskId).toBeNull()
    })

    it('advances a daily-repeating task to the next day without deleting (history FK survives)', async () => {
      const task = await makeTask({
        repeat: 'Daily',
        due: '2026-5-12',
      })
      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: true })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated).toBeDefined()
      expect(updated.due).not.toBe(task.due)

      // Task wasn't deleted, so the history FK should still point at it.
      const hist = await db
        .select()
        .from(history)
        .where(eq(history.userId, TEST_USER))
      expect(hist).toHaveLength(1)
      expect(hist[0].taskId).toBe(task.id)
    })

    it('on a task with undone subtasks, advances the next subtask instead of completing the whole task', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false },
        ],
      })
      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: false })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.subtasks[0].done).toBe(true)
      expect(updated.subtasks[1].done).toBe(false)

      // No history row written for a subtask advance.
      const hist = await db
        .select()
        .from(history)
        .where(eq(history.userId, TEST_USER))
      expect(hist).toHaveLength(0)
    })

    it('completing the last subtask completes the whole task', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: true },
          { title: 's2', done: false },
        ],
      })
      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: true })

      // Task is one-shot, so it should be gone.
      const remaining = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(remaining).toHaveLength(0)
    })

    it('pauses a running timer when completing the last actionable subtask leaves the task snoozed', async () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false, snooze: future },
          { title: 's2', done: false },
        ],
      })
      await db
        .update(tasks)
        .set({
          timerStartedAt: new Date(Date.now() - 60_000),
          timerAccumulatedSeconds: 0,
        })
        .where(eq(tasks.id, task.id))

      // s2 is the only actionable subtask; completing it leaves the task
      // with nothing actionable (s1 still snoozed) — so it should bank the
      // running timer, mirroring the snooze path.
      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: false })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.subtasks[1].done).toBe(true)
      expect(updated.timerStartedAt).toBeNull()
      expect(updated.timerAccumulatedSeconds).toBeGreaterThan(55)
    })

    it('leaves a running timer alone when completing a subtask that still leaves actionable ones', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false },
        ],
      })
      await db
        .update(tasks)
        .set({
          timerStartedAt: new Date(Date.now() - 60_000),
          timerAccumulatedSeconds: 0,
        })
        .where(eq(tasks.id, task.id))

      const result = await completeTask(TEST_USER, task.id, 300)
      expect(result).toEqual({ advanced: false })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).not.toBeNull()
      expect(updated.timerAccumulatedSeconds).toBe(0)
    })
  })

  describe('snoozeTask', () => {
    it('sets task.snooze when there are no subtasks', async () => {
      const task = await makeTask()
      const result = await snoozeTask(TEST_USER, task.id, false)
      expect(result).toEqual({ scope: 'task' })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.snooze).toBeTruthy()
    })

    it('sets the next actionable subtask.snooze when subtasks exist', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false },
        ],
      })
      const result = await snoozeTask(TEST_USER, task.id, false)
      expect(result).toEqual({ scope: 'subtask' })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.subtasks[0].snooze).toBeTruthy()
      expect(updated.subtasks[1].snooze).toBeFalsy()
      expect(updated.snooze).toBeNull()
    })

    it('with allSubtasks=true, snoozes the whole task even when subtasks exist', async () => {
      const task = await makeTask({
        subtasks: [{ title: 's1', done: false }],
      })
      const result = await snoozeTask(TEST_USER, task.id, true)
      expect(result).toEqual({ scope: 'task' })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.snooze).toBeTruthy()
      // Subtasks unchanged.
      expect(updated.subtasks[0].snooze).toBeFalsy()
    })

    it('writes a snoozed event to task_events', async () => {
      const task = await makeTask()
      await snoozeTask(TEST_USER, task.id, false)

      const events = await db
        .select()
        .from(taskEvents)
        .where(eq(taskEvents.userId, TEST_USER))
      expect(events).toHaveLength(1)
      expect(events[0].kind).toBe('snoozed')
      expect(events[0].taskId).toBe(task.id)
    })

    // Helper: start a running timer 60s in the past so the pause should
    // bank ~60s.
    async function startTimerSixtySecondsAgo(id: string) {
      await db
        .update(tasks)
        .set({
          timerStartedAt: new Date(Date.now() - 60_000),
          timerAccumulatedSeconds: 0,
        })
        .where(eq(tasks.id, id))
    }

    it('pauses a running timer when the whole task is snoozed', async () => {
      const task = await makeTask()
      await startTimerSixtySecondsAgo(task.id)

      await snoozeTask(TEST_USER, task.id, false)

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).toBeNull()
      expect(updated.timerAccumulatedSeconds).toBeGreaterThan(55)
      expect(updated.timerAccumulatedSeconds).toBeLessThan(65)
    })

    it('pauses a running timer when all subtasks are snoozed at once', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false },
        ],
      })
      await startTimerSixtySecondsAgo(task.id)

      await snoozeTask(TEST_USER, task.id, true)

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).toBeNull()
      expect(updated.timerAccumulatedSeconds).toBeGreaterThan(55)
    })

    it('pauses a running timer when the last actionable subtask is snoozed', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: true },
          { title: 's2', done: false },
        ],
      })
      await startTimerSixtySecondsAgo(task.id)

      // Only one actionable subtask left — snoozing it leaves the whole
      // task snoozed.
      const result = await snoozeTask(TEST_USER, task.id, false)
      expect(result).toEqual({ scope: 'subtask' })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).toBeNull()
      expect(updated.timerAccumulatedSeconds).toBeGreaterThan(55)
    })

    it('leaves a running timer alone when other subtasks remain actionable', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false },
        ],
      })
      await startTimerSixtySecondsAgo(task.id)

      await snoozeTask(TEST_USER, task.id, false)

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).not.toBeNull()
      expect(updated.timerAccumulatedSeconds).toBe(0)
    })
  })

  describe('snoozeManyTasks', () => {
    it('snoozes every task in the batch and writes an event per task', async () => {
      const a = await makeTask({ title: 'a' })
      const b = await makeTask({ title: 'b' })

      const result = await snoozeManyTasks(TEST_USER, [a.id, b.id])
      expect(result).toEqual({ count: 2 })

      const rows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.userId, TEST_USER))
      expect(rows.every((t) => t.snooze)).toBe(true)

      const events = await db
        .select()
        .from(taskEvents)
        .where(eq(taskEvents.userId, TEST_USER))
      expect(events).toHaveLength(2)
      expect(events.every((e) => e.kind === 'snoozed')).toBe(true)
    })

    it('snoozes the whole task even when it has subtasks', async () => {
      const task = await makeTask({
        subtasks: [{ title: 's1', done: false }],
      })

      await snoozeManyTasks(TEST_USER, [task.id])

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.snooze).toBeTruthy()
      expect(updated.subtasks[0].snooze).toBeFalsy()
    })

    it('skips unknown ids rather than throwing, counting only found tasks', async () => {
      const a = await makeTask({ title: 'a' })

      const result = await snoozeManyTasks(TEST_USER, [a.id, BOGUS_UUID])
      expect(result).toEqual({ count: 1 })

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, a.id))
      expect(updated.snooze).toBeTruthy()
    })

    it('banks a running timer on a batched task', async () => {
      const task = await makeTask()
      await db
        .update(tasks)
        .set({
          timerStartedAt: new Date(Date.now() - 60_000),
          timerAccumulatedSeconds: 0,
        })
        .where(eq(tasks.id, task.id))

      await snoozeManyTasks(TEST_USER, [task.id])

      const [updated] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, task.id))
      expect(updated.timerStartedAt).toBeNull()
      expect(updated.timerAccumulatedSeconds).toBeGreaterThanOrEqual(59)
    })

    it('is a no-op for an empty batch', async () => {
      expect(await snoozeManyTasks(TEST_USER, [])).toEqual({ count: 0 })
    })
  })

  describe('applyTimerAction stale guard', () => {
    it('rejects an action whose `at` is older than the row updatedAt', async () => {
      const task = await makeTask()
      // Seed: timer running, last touched a moment ago.
      const justNow = new Date()
      await db
        .update(tasks)
        .set({
          timerStartedAt: justNow,
          timerAccumulatedSeconds: 0,
          updatedAt: justNow,
        })
        .where(eq(tasks.id, task.id))

      // Replay a pause from 1h ago — older than updatedAt.
      const staleAt = new Date(justNow.getTime() - 60 * 60 * 1000).toISOString()
      const replayed = await applyTimerAction(TEST_USER, task.id, {
        kind: 'pause',
        at: staleAt,
      })

      expect(replayed.timerStartedAt).not.toBeNull()
      expect(replayed.timerAccumulatedSeconds).toBe(0)
      expect(replayed.updatedAt.getTime()).toBe(justNow.getTime())
    })

    it('applies an action whose `at` is newer than updatedAt', async () => {
      const task = await makeTask()
      // Seed: timer started 60s ago, row touched then too.
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000)
      await db
        .update(tasks)
        .set({
          timerStartedAt: sixtySecondsAgo,
          timerAccumulatedSeconds: 0,
          updatedAt: sixtySecondsAgo,
        })
        .where(eq(tasks.id, task.id))

      const paused = await applyTimerAction(TEST_USER, task.id, {
        kind: 'pause',
        at: new Date().toISOString(),
      })

      expect(paused.timerStartedAt).toBeNull()
      expect(paused.timerAccumulatedSeconds).toBeGreaterThan(55)
      expect(paused.timerAccumulatedSeconds).toBeLessThan(65)
    })
  })

  describe('applyTimerAction single-timer constraint', () => {
    it('pauses any other running timer when a new one starts, banking its elapsed', async () => {
      const a = await makeTask({ title: 'A' })
      const b = await makeTask({ title: 'B' })
      // A has been running for 60s.
      const sixtySecondsAgo = new Date(Date.now() - 60 * 1000)
      await db
        .update(tasks)
        .set({
          timerStartedAt: sixtySecondsAgo,
          timerAccumulatedSeconds: 0,
          updatedAt: sixtySecondsAgo,
        })
        .where(eq(tasks.id, a.id))

      const started = await applyTimerAction(TEST_USER, b.id, { kind: 'start' })
      expect(started.timerStartedAt).not.toBeNull()

      const [pausedA] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, a.id))
      expect(pausedA.timerStartedAt).toBeNull()
      expect(pausedA.timerAccumulatedSeconds).toBeGreaterThan(55)
      expect(pausedA.timerAccumulatedSeconds).toBeLessThan(65)
    })

    it('leaves other timers running when starting an already-running timer (idempotent)', async () => {
      const a = await makeTask({ title: 'A' })
      const b = await makeTask({ title: 'B' })
      const now = new Date()
      await db
        .update(tasks)
        .set({ timerStartedAt: now, timerAccumulatedSeconds: 0, updatedAt: now })
        .where(eq(tasks.id, a.id))
      await db
        .update(tasks)
        .set({ timerStartedAt: now, timerAccumulatedSeconds: 0, updatedAt: now })
        .where(eq(tasks.id, b.id))

      // Re-starting B (already running) must not touch A.
      await applyTimerAction(TEST_USER, b.id, { kind: 'start' })

      const [stillA] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, a.id))
      expect(stillA.timerStartedAt).not.toBeNull()
    })
  })

  describe('applyTimerAction wakes a snoozed task on start', () => {
    const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString()

    it('clears a task-level snooze when starting its timer', async () => {
      const task = await makeTask()
      await snoozeTask(TEST_USER, task.id, false)

      const started = await applyTimerAction(TEST_USER, task.id, {
        kind: 'start',
      })

      expect(started.timerStartedAt).not.toBeNull()
      expect(started.snooze).toBeNull()
    })

    it('clears subtask snoozes when every incomplete subtask is snoozed', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: true },
          { title: 's2', done: false, snooze: inAnHour() },
          { title: 's3', done: false, snooze: inAnHour() },
        ],
      })

      const started = await applyTimerAction(TEST_USER, task.id, {
        kind: 'start',
      })

      expect(started.timerStartedAt).not.toBeNull()
      expect(started.subtasks.every((s) => !s.snooze)).toBe(true)
    })

    it('leaves snoozes untouched when an actionable subtask remains', async () => {
      const task = await makeTask({
        subtasks: [
          { title: 's1', done: false },
          { title: 's2', done: false, snooze: inAnHour() },
        ],
      })

      const started = await applyTimerAction(TEST_USER, task.id, {
        kind: 'start',
      })

      expect(started.timerStartedAt).not.toBeNull()
      // The task isn't snoozed (s1 is actionable), so the snoozed s2 stays.
      expect(started.subtasks.find((s) => s.title === 's2')?.snooze).toBeTruthy()
    })

    it('does not snooze-touch a plain non-snoozed task', async () => {
      const task = await makeTask()

      const started = await applyTimerAction(TEST_USER, task.id, {
        kind: 'start',
      })

      expect(started.timerStartedAt).not.toBeNull()
      expect(started.snooze).toBeNull()
    })
  })
})
