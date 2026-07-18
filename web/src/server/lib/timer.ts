import { and, eq, isNotNull, ne } from 'drizzle-orm'

import { tasks } from '@dtn/shared/schema'
import { isSnoozed } from '@dtn/shared/task-sorting'
import { ceilTaskTime } from '@dtn/shared/timer-utils'
import { db } from '../../db'
import { syncLockScreenSoon } from './lockscreen'
import { setSelectionTx } from './selection'
import type { Task } from '@dtn/shared/schema'

export type TimerAction = (
  | { kind: 'start' }
  | { kind: 'pause' }
  | { kind: 'add'; seconds: number }
  | { kind: 'reset' }
) & { at?: string }

// Compute the live elapsed seconds for a task. Encapsulated here so the
// server applies the same math as the client UI: when running, the value
// keeps ticking from `timerStartedAt`; when paused, it's whatever's been
// banked in `timerAccumulatedSeconds`.
export function currentTimerSeconds(task: Task, now: Date): number {
  if (task.timerStartedAt) {
    const elapsed = (now.getTime() - task.timerStartedAt.getTime()) / 1000
    return Math.max(0, task.timerAccumulatedSeconds + elapsed)
  }
  return task.timerAccumulatedSeconds
}

type Conn = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

async function loadTask(
  conn: Conn,
  userId: string,
  id: string,
): Promise<Task | null> {
  const rows = await conn
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ?? null
}

// 0-time-frame children don't have their own timer; their time is tracked
// on the keeper. Resolve to the effective task (the one whose row actually
// holds the timer state) so the caller — and the API surface — doesn't
// have to care about the indirection.
async function resolveTimerTarget(
  conn: Conn,
  userId: string,
  id: string,
): Promise<Task> {
  const task = await loadTask(conn, userId, id)
  if (!task) throw new Error('Task not found')
  if (task.timekeeperId) {
    const keeper = await loadTask(conn, userId, task.timekeeperId)
    if (!keeper) {
      // Keeper FK is RESTRICT-on-delete, so this shouldn't happen except
      // mid-migration. Surface explicitly rather than silently fall back.
      throw new Error('Timekeeper missing (data corruption?)')
    }
    return keeper
  }
  return task
}

// Pause any other timers currently running for this user, banking their
// elapsed time. Runs on the caller's transaction so a failure aborts the
// enclosing start.
async function pauseOtherRunningTimers(
  conn: Conn,
  userId: string,
  exceptId: string,
  now: Date,
): Promise<void> {
  const running = await conn
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        ne(tasks.id, exceptId),
        isNotNull(tasks.timerStartedAt),
      ),
    )
  for (const other of running) {
    const elapsed = (now.getTime() - other.timerStartedAt!.getTime()) / 1000
    await conn
      .update(tasks)
      .set({
        timerStartedAt: null,
        timerAccumulatedSeconds: Math.max(
          0,
          other.timerAccumulatedSeconds + elapsed,
        ),
        updatedAt: now,
      })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, other.id)))
  }
}

// Pause a single task's timer (resolving child→keeper), banking elapsed
// time. Runs on the caller's connection so it can commit atomically with
// the surrounding work (e.g. clearing the selection in one transaction).
// No-op when the timer is already paused.
export async function pauseTimerTx(
  conn: Conn,
  userId: string,
  id: string,
  now: Date,
): Promise<void> {
  const target = await resolveTimerTarget(conn, userId, id)
  if (!target.timerStartedAt) return
  const elapsed = (now.getTime() - target.timerStartedAt.getTime()) / 1000
  await conn
    .update(tasks)
    .set({
      timerStartedAt: null,
      timerAccumulatedSeconds: Math.max(
        0,
        target.timerAccumulatedSeconds + elapsed,
      ),
      updatedAt: now,
    })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, target.id)))
}

export async function applyTimerAction(
  userId: string,
  id: string,
  action: TimerAction,
): Promise<Task> {
  const result = await db.transaction(async (tx) => {
    const target = await resolveTimerTarget(tx, userId, id)
    const serverNow = new Date()
    // Clamp client-stamped `at` to server-now so a clock-skewed device can't inflate elapsed time or jump past the stale guard.
    const at = action.at
      ? new Date(Math.min(new Date(action.at).getTime(), serverNow.getTime()))
      : null
    if (at && at.getTime() < target.updatedAt.getTime()) {
      return ceilTaskTime(target)
    }
    const now = at ?? serverNow

    let nextStartedAt: Date | null = target.timerStartedAt
    let nextAccumulated = target.timerAccumulatedSeconds
    // Starting a timer means "I'm working on this now", so it pulls a snoozed
    // task back into the active list — whether snoozed at the task level or
    // because every incomplete subtask is snoozed. Mirrors unsnoozeTask:
    // clear the task snooze and any snoozed subtasks.
    let wakeFields: { snooze: null; subtasks: Task['subtasks'] } | object = {}

    switch (action.kind) {
      case 'start':
        // Idempotent: if already running, leave the existing start time
        // alone so we don't accidentally rebase elapsed seconds.
        if (!target.timerStartedAt) {
          // Only one timer runs at a time: pause every other running timer
          // first, inside this same transaction, so a failed pause rolls
          // back the start too.
          await pauseOtherRunningTimers(tx, userId, target.id, now)
          nextStartedAt = now
        }
        // Starting a timer *is* selecting the task. Store the id the user
        // acted on (a child, not the resolved keeper) so the Focus View
        // shows what they picked. Committed with the timer in one tx.
        await setSelectionTx(tx, userId, id, now)
        if (isSnoozed(target)) {
          wakeFields = {
            snooze: null,
            subtasks: target.subtasks.map((s) =>
              s.snooze ? { ...s, snooze: undefined } : s,
            ),
          }
        }
        break
      case 'pause':
        // Bank the elapsed time and clear the start marker. Idempotent
        // when already paused.
        if (target.timerStartedAt) {
          const elapsed =
            (now.getTime() - target.timerStartedAt.getTime()) / 1000
          nextAccumulated = Math.max(
            0,
            target.timerAccumulatedSeconds + elapsed,
          )
          nextStartedAt = null
        }
        break
      case 'add': {
        // Signed delta. Floor the total at 0 so a user can't underflow
        // by subtracting more than the bank holds.
        const current = currentTimerSeconds(target, now)
        const next = Math.max(0, current + action.seconds)
        if (target.timerStartedAt) {
          // Keep running but rebase: the new accumulated is `next` and
          // start time is now (so elapsed since "now" is 0).
          nextAccumulated = next
          nextStartedAt = now
        } else {
          nextAccumulated = next
          nextStartedAt = null
        }
        break
      }
      case 'reset':
        nextAccumulated = 0
        nextStartedAt = null
        break
    }

    const [updated] = await tx
      .update(tasks)
      .set({
        timerStartedAt: nextStartedAt,
        timerAccumulatedSeconds: nextAccumulated,
        updatedAt: now,
        ...wakeFields,
      })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, target.id)))
      .returning()

    return ceilTaskTime(updated)
  })
  // In the shared lib, not the routes, so BOTH entry points — the web
  // app's server-fns and the mobile REST routes — mirror the change onto
  // the Lock Screen Timer.
  syncLockScreenSoon(userId)
  return result
}
