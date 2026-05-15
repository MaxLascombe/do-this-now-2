import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import {
  dailyProgress,
  history,
  taskEvents,
  tasks,
} from '@dtn/shared/schema'

import { db } from '../../../db'
import { completeTask, snoozeTask } from '../actions'
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
  await db.delete(tasks).where(eq(tasks.userId, TEST_USER))
  await db.delete(dailyProgress).where(eq(dailyProgress.userId, TEST_USER))
}

type TaskOverrides = Partial<{
  title: string
  emoji: string
  due: string
  repeat: 'No Repeat' | 'Daily' | 'Weekdays' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom'
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
      await expect(
        completeTask(TEST_USER, BOGUS_UUID, 300),
      ).rejects.toThrow('Task not found')
    })

    it('snoozeTask reaches the transaction body (throws Task not found on bogus id, NOT a driver error)', async () => {
      await expect(
        snoozeTask(TEST_USER, BOGUS_UUID, false),
      ).rejects.toThrow('Task not found')
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
})
