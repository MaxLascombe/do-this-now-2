import { and, eq, gte, lt } from 'drizzle-orm'

import { db } from '../../db'
import {
  history,
  type SubTask,
  type Task,
  tasks,
} from '@dtn/shared/schema'
import { dateString, nextDueDate } from '@dtn/shared/helpers'

const HOUR_MS = 60 * 60 * 1000

async function loadTask(userId: string, id: string): Promise<Task | null> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ?? null
}

export async function completeTaskAction(
  userId: string,
  id: string,
): Promise<{ ok: true; advanced: boolean }> {
  const task = await loadTask(userId, id)
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
        await db
          .update(tasks)
          .set({ subtasks: newSubtasks, updatedAt: now })
          .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
        return { ok: true, advanced: false }
      }

      task.subtasks = newSubtasks
    }
  }

  await db.insert(history).values({
    userId,
    taskId: task.id,
    taskSnapshot: task,
    completedAt: now,
  })

  const newDue = nextDueDate(task)
  if (task.repeat === 'No Repeat' || newDue === undefined) {
    await db
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
  } else {
    const resetSubtasks: SubTask[] = task.subtasks.map((s) => ({
      ...s,
      done: false,
      snooze: undefined,
    }))
    await db
      .update(tasks)
      .set({
        due: dateString(newDue),
        subtasks: resetSubtasks,
        updatedAt: now,
      })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
  }

  return { ok: true, advanced: true }
}

export async function snoozeTaskAction(
  userId: string,
  id: string,
  allSubtasks: boolean = false,
): Promise<{ ok: true; scope: 'subtask' | 'task' }> {
  const task = await loadTask(userId, id)
  if (!task) throw new Error('Task not found')

  const newSnooze = new Date(Date.now() + HOUR_MS).toISOString()

  const hasUnsnoozedSubtask =
    !allSubtasks &&
    task.subtasks.length > 0 &&
    task.subtasks.some(
      (s) =>
        !s.done && (!s.snooze || new Date(s.snooze) <= new Date()),
    )

  if (hasUnsnoozedSubtask) {
    const idx = task.subtasks.findIndex(
      (s) =>
        !s.done && (!s.snooze || new Date(s.snooze) <= new Date()),
    )
    const newSubtasks: SubTask[] = task.subtasks.map((s, i) =>
      i === idx ? { ...s, snooze: newSnooze } : s,
    )
    await db
      .update(tasks)
      .set({ subtasks: newSubtasks, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
    return { ok: true, scope: 'subtask' }
  }

  await db
    .update(tasks)
    .set({ snooze: newSnooze, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, task.id)))
  return { ok: true, scope: 'task' }
}

export async function getHistoryForDateAction(
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
