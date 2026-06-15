import { and, eq, gte, lt } from 'drizzle-orm'

import { history, taskEvents, tasks } from '@dtn/shared/schema'
import { isSnoozed } from '@dtn/shared/task-sorting'
import {
  applyFullCompletion,
  completeTaskTransition,
  snoozeTaskTransition,
} from '@dtn/shared/task-transitions'
import { HOUR_MS } from '@dtn/shared/time'
import { db } from '../../db'
import { finalizeTodayProgress } from './progress'
import { currentTimerSeconds } from './timer'
import type { Task } from '@dtn/shared/schema'

// Thrown when an action targets a task id that doesn't exist (e.g. a stale
// client acting on a task deleted elsewhere). REST routes map it to 404.
export class TaskNotFoundError extends Error {}

// `loadTask` accepts either the top-level `db` or a `tx` handle so the
// caller can run it inside a transaction. The transaction param type is
// inferred from db.transaction's callback signature.
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

export async function completeTask(
  userId: string,
  id: string,
  tzOffsetMin: number,
  countMeasurement: boolean = true,
): Promise<{ advanced: boolean }> {
  // The history insert + task update/delete must be atomic — without a
  // transaction, a double-tap on "Done" can race: two history rows for
  // the same completion, or insert succeeds and the follow-up update is
  // lost.
  const completionResult = await db.transaction(async (tx) => {
    const task = await loadTask(tx, userId, id)
    if (!task) throw new TaskNotFoundError('Task not found')

    const now = new Date()
    const transition = completeTaskTransition(task, now)

    if (transition.kind === 'advance-subtask') {
      // Completing the last actionable subtask leaves the task snoozed —
      // bank the running timer, mirroring the snooze path.
      const timerFields =
        task.timerStartedAt && isSnoozed(transition.nextTask)
          ? {
              timerStartedAt: null,
              timerAccumulatedSeconds: currentTimerSeconds(task, now),
            }
          : {}
      await tx
        .update(tasks)
        .set({
          subtasks: transition.nextTask.subtasks,
          updatedAt: now,
          ...timerFields,
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
      return { advanced: false }
    }

    // Full completion: hand off to applyFullCompletion which figures out
    // how many history rows to write (1 for fluid / one-shot / child;
    // floor(timer/target) for repeating fixed), the per-row credit, the
    // carryover seconds for the next instance, and whether the task row
    // should be updated or deleted.
    const actualSeconds = currentTimerSeconds(task, now)
    const result = applyFullCompletion({
      task,
      actualSeconds,
      now,
      countMeasurement,
    })

    // All N history rows share the same snapshot. Inserting in a single
    // .values([...]) call so Drizzle batches into one INSERT.
    const rows = Array.from({ length: result.completions }, () => ({
      userId,
      taskId: task.id,
      taskSnapshot: result.snapshot,
      actualSeconds: result.actualSecondsPerRow,
      completedAt: now,
    }))
    await tx.insert(history).values(rows)

    if (result.nextTask === null) {
      await tx
        .delete(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    } else {
      await tx
        .update(tasks)
        .set({
          due: result.nextTask.due,
          subtasks: result.nextTask.subtasks,
          timeFrame: result.nextTask.timeFrame,
          measurementCount: result.nextTask.measurementCount,
          timerStartedAt: result.nextTask.timerStartedAt,
          timerAccumulatedSeconds: result.nextTask.timerAccumulatedSeconds,
          updatedAt: now,
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    }

    return { advanced: true }
  })

  // Persist tomorrow's streak/lives rollover now that `done` has changed.
  // Was previously done inside getProgressToday on every GET — moved here
  // so REST GETs stay side-effect-free. Errors don't roll back the
  // completion: a failed rollover write just means the GET next refresh
  // will see the recomputed (correct) values and the persist will be
  // re-attempted on the next completion.
  try {
    await finalizeTodayProgress(userId, tzOffsetMin)
  } catch (err) {
    console.error('finalizeTodayProgress failed after completeTask', err)
  }

  return completionResult
}

export async function snoozeTask(
  userId: string,
  id: string,
  allSubtasks: boolean = false,
): Promise<{ scope: 'subtask' | 'task' }> {
  // Load-then-update sequence — wrap in a transaction so two concurrent
  // snoozes on the same task (e.g. a fast double-tap) can't read the same
  // baseline and clobber each other's subtask write. Same exposure that
  // motivated wrapping completeTask in a tx.
  return db.transaction(async (tx) => {
    const task = await loadTask(tx, userId, id)
    if (!task) throw new TaskNotFoundError('Task not found')

    await tx
      .insert(taskEvents)
      .values({ userId, taskId: task.id, kind: 'snoozed' })

    const now = new Date()
    const transition = snoozeTaskTransition(task, allSubtasks, now)

    // When the snooze takes the whole task out of the active list — whether
    // the top-level snooze is set or the last actionable subtask just got
    // snoozed — bank a running timer so its time doesn't keep climbing while
    // the task is away. No-op when already paused.
    const timerFields =
      task.timerStartedAt && isSnoozed(transition.nextTask)
        ? {
            timerStartedAt: null,
            timerAccumulatedSeconds: currentTimerSeconds(task, now),
          }
        : {}

    if (transition.scope === 'subtask') {
      await tx
        .update(tasks)
        .set({
          subtasks: transition.nextTask.subtasks,
          updatedAt: transition.nextTask.updatedAt,
          ...timerFields,
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    } else {
      await tx
        .update(tasks)
        .set({
          snooze: transition.nextTask.snooze,
          updatedAt: transition.nextTask.updatedAt,
          ...timerFields,
        })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    }

    return { scope: transition.scope }
  })
}

// Bring a snoozed task fully back to the active list: clear the top-level
// snooze and any snoozed subtasks. The inverse of snoozeTask, used both for
// the explicit "Wake" action and to undo an accidental snooze.
export async function unsnoozeTask(userId: string, id: string): Promise<Task> {
  return db.transaction(async (tx) => {
    const task = await loadTask(tx, userId, id)
    if (!task) throw new TaskNotFoundError('Task not found')

    const subtasks = task.subtasks.map((s) =>
      s.snooze ? { ...s, snooze: undefined } : s,
    )
    const [row] = await tx
      .update(tasks)
      .set({ snooze: null, subtasks, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
      .returning()
    return row
  })
}

// Whole-task snooze for a batch — backs the "snooze everything after the
// current task" action. Unlike snoozeTask this always pushes the whole task
// out (never just a subtask) so each one definitely leaves the active list,
// banking any running timer. Unknown ids are skipped, not an error.
export async function snoozeManyTasks(
  userId: string,
  ids: string[],
): Promise<{ count: number }> {
  if (ids.length === 0) return { count: 0 }
  return db.transaction(async (tx) => {
    const now = new Date()
    const snooze = new Date(now.getTime() + HOUR_MS).toISOString()
    let count = 0
    for (const id of ids) {
      const task = await loadTask(tx, userId, id)
      if (!task) continue
      await tx
        .insert(taskEvents)
        .values({ userId, taskId: task.id, kind: 'snoozed' })
      const timerFields = task.timerStartedAt
        ? {
            timerStartedAt: null,
            timerAccumulatedSeconds: currentTimerSeconds(task, now),
          }
        : {}
      await tx
        .update(tasks)
        .set({ snooze, updatedAt: now, ...timerFields })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
      count++
    }
    return { count }
  })
}

export async function getHistory(
  userId: string,
  date: string,
  tzOffsetMin: number,
) {
  const [year, month, day] = date.split('-').map((s) => parseInt(s))
  // Bracket the user's local day in UTC.
  const startMs = Date.UTC(year, month - 1, day) + tzOffsetMin * 60000
  const start = new Date(startMs)
  const end = new Date(startMs + 24 * 60 * 60 * 1000)
  return db
    .select()
    .from(history)
    .where(
      and(
        eq(history.userId, userId),
        gte(history.completedAt, start),
        lt(history.completedAt, end),
      ),
    )
}
