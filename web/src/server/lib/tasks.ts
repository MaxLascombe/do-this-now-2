import { and, eq } from 'drizzle-orm'

import { db } from '../../db'
import { getUserToday } from '@dtn/shared/helpers'
import { type Task, taskEvents, tasks } from '@dtn/shared/schema'
import { type TaskInput } from '@dtn/shared/task-input'
import { sortTasks } from '@dtn/shared/task-sorting'

export {
  repeatOptionSchema,
  repeatUnitSchema,
  repeatWeekdaysSchema,
  subTaskSchema,
  taskInputSchema,
  type TaskInput,
} from '@dtn/shared/task-input'

export async function listTasks(userId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.userId, userId))
}

export async function listTopTasks(
  userId: string,
  tzOffsetMin: number,
): Promise<Task[]> {
  const all = await listTasks(userId)
  const { todayDate } = getUserToday(tzOffsetMin)
  sortTasks(all, todayDate)
  return all
}

export async function getTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ?? null
}

export async function createTask(
  userId: string,
  input: TaskInput,
): Promise<Task> {
  const [row] = await db
    .insert(tasks)
    .values({ ...input, userId })
    .returning()
  return row
}

export async function updateTask(
  userId: string,
  id: string,
  input: TaskInput,
): Promise<Task | null> {
  const [row] = await db
    .update(tasks)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .returning()
  return row ?? null
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  // Record the 'deleted' event BEFORE the actual DELETE — the FK on
  // task_events.task_id sets to NULL on cascade, so the event row
  // survives, but inserting before keeps the link populated while the
  // task exists.
  await db.transaction(async (tx) => {
    await tx
      .insert(taskEvents)
      .values({ userId, taskId: id, kind: 'deleted' })
    await tx
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
  })
}
