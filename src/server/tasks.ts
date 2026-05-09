import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '../db'
import { type Task, tasks } from '../db/schema'
import { dateString } from '../lib/helpers'
import { sortTasks } from '../lib/task-sorting'
import { requireUserId } from './auth'

const subTaskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  snooze: z.string().optional(),
})

const repeatWeekdaysSchema = z.tuple([
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
])

const repeatOptionSchema = z.enum([
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
])

const repeatUnitSchema = z.enum(['day', 'week', 'month', 'year'])

const taskInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due: z.string(), // 'YYYY-M-D' or 'No Due Date'
  strictDeadline: z.boolean(),
  repeat: repeatOptionSchema,
  repeatInterval: z.number().int().positive(),
  repeatUnit: repeatUnitSchema,
  repeatWeekdays: repeatWeekdaysSchema,
  timeFrame: z.number().int().nonnegative(),
  subtasks: z.array(subTaskSchema),
})

export const getAllTasks = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Task[]> => {
    const userId = await requireUserId()
    return db.select().from(tasks).where(eq(tasks.userId, userId))
  },
)

export const getTopTasks = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Task[]> => {
    const userId = await requireUserId()
    const all = await db.select().from(tasks).where(eq(tasks.userId, userId))
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    sortTasks(all, today)
    return all
  },
)

export const getTask = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<Task | null> => {
    const userId = await requireUserId()
    const rows = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, data.id)))
      .limit(1)
    return rows[0] ?? null
  })

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => taskInputSchema.parse(d))
  .handler(async ({ data }): Promise<Task> => {
    const userId = await requireUserId()
    const [row] = await db
      .insert(tasks)
      .values({ ...data, userId })
      .returning()
    return row
  })

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    taskInputSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<Task | null> => {
    const userId = await requireUserId()
    const { id, ...rest } = data
    const [row] = await db
      .update(tasks)
      .set({ ...rest, updatedAt: new Date() })
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
      .returning()
    return row ?? null
  })

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const userId = await requireUserId()
    await db
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, data.id)))
    return { ok: true }
  })

// Used by completeTask to record date strings consistently.
export const _todayString = () => dateString(new Date())
