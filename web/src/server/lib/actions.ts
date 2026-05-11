import { and, eq, gte, lt } from 'drizzle-orm'

import { db } from '../../db'
import {
  history,
  type SubTask,
  type Task,
  taskEvents,
  tasks,
} from '@dtn/shared/schema'
import { dateString, nextDueDate } from '@dtn/shared/helpers'
import { HOUR_MS } from '@dtn/shared/time'
import { finalizeTodayProgress } from './progress'

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
): Promise<{ advanced: boolean }> {
  // The history insert + task update/delete must be atomic — without a
  // transaction, a double-tap on "Done" can race: two history rows for
  // the same completion, or insert succeeds and the follow-up update is
  // lost.
  const result = await db.transaction(async (tx) => {
    const task = await loadTask(tx, userId, id)
    if (!task) throw new Error('Task not found')

    const now = new Date()

    if (task.subtasks.length > 0 && task.subtasks.some((s) => !s.done)) {
      const next =
        task.subtasks.find(
          (s) =>
            !s.done && (!s.snooze || new Date(s.snooze) < new Date()),
        ) ?? task.subtasks.find((s) => !s.done)
      if (next) {
        const newSubtasks: SubTask[] = task.subtasks.map((s) =>
          s === next ? { ...s, done: true } : s,
        )
        const stillUndone = newSubtasks.some((s) => !s.done)

        if (stillUndone) {
          await tx
            .update(tasks)
            .set({ subtasks: newSubtasks, updatedAt: now })
            .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
          return { advanced: false }
        }

        task.subtasks = newSubtasks
      }
    }

    await tx.insert(history).values({
      userId,
      taskId: task.id,
      taskSnapshot: task,
      completedAt: now,
    })

    const newDue = nextDueDate(task)
    if (task.repeat === 'No Repeat' || newDue === undefined) {
      await tx
        .delete(tasks)
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    } else {
      const resetSubtasks: SubTask[] = task.subtasks.map((s) => ({
        ...s,
        done: false,
        snooze: undefined,
      }))
      await tx
        .update(tasks)
        .set({
          due: dateString(newDue),
          subtasks: resetSubtasks,
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

  return result
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
    if (!task) throw new Error('Task not found')

    await tx
      .insert(taskEvents)
      .values({ userId, taskId: task.id, kind: 'snoozed' })

    const newSnooze = new Date(Date.now() + HOUR_MS).toISOString()

    const hasUnsnoozedSubtask =
      !allSubtasks &&
      task.subtasks.length > 0 &&
      task.subtasks.some(
        (s) => !s.done && (!s.snooze || new Date(s.snooze) < new Date()),
      )

    if (hasUnsnoozedSubtask) {
      const idx = task.subtasks.findIndex(
        (s) => !s.done && (!s.snooze || new Date(s.snooze) < new Date()),
      )
      const newSubtasks: SubTask[] = task.subtasks.map((s, i) =>
        i === idx ? { ...s, snooze: newSnooze } : s,
      )
      await tx
        .update(tasks)
        .set({ subtasks: newSubtasks, updatedAt: new Date() })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
      return { scope: 'subtask' }
    }

    await tx
      .update(tasks)
      .set({ snooze: newSnooze, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    return { scope: 'task' }
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
