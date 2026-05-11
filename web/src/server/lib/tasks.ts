import { and, eq } from 'drizzle-orm'

import { db } from '../../db'
import { getUserToday } from '@dtn/shared/helpers'
import { type Task, tasks } from '@dtn/shared/schema'
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

export async function getTaskById(
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

export async function createTaskRow(
  userId: string,
  input: TaskInput,
): Promise<Task> {
  const [row] = await db
    .insert(tasks)
    .values({ ...input, userId })
    .returning()
  return row
}

export async function updateTaskRow(
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

export async function deleteTaskRow(userId: string, id: string): Promise<void> {
  await db.delete(tasks).where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
}
