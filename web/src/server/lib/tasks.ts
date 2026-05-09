import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../../db'
import { type Task, tasks } from '@dtn/shared/schema'
import { sortTasks } from '@dtn/shared/task-sorting'

export const subTaskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  snooze: z.string().optional(),
})

export const repeatWeekdaysSchema = z.tuple([
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
])

export const repeatOptionSchema = z.enum([
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
])

export const repeatUnitSchema = z.enum(['day', 'week', 'month', 'year'])

export const taskInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due: z.string(),
  strictDeadline: z.boolean(),
  repeat: repeatOptionSchema,
  repeatInterval: z.number().int().positive(),
  repeatUnit: repeatUnitSchema,
  repeatWeekdays: repeatWeekdaysSchema,
  timeFrame: z.number().int().nonnegative(),
  subtasks: z.array(subTaskSchema),
})

export type TaskInput = z.infer<typeof taskInputSchema>

export async function listTasks(userId: string): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.userId, userId))
}

export async function listTopTasks(userId: string): Promise<Task[]> {
  const all = await listTasks(userId)
  const today = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  )
  sortTasks(all, today)
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
