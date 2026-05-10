import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import {
  createTaskRow,
  deleteTaskRow,
  getTaskById,
  listTasks,
  listTopTasks,
  taskInputSchema,
  updateTaskRow,
} from './lib/tasks'

export const getAllTasks = createServerFn({ method: 'GET' }).handler(
  async () => listTasks(await requireUserId()),
)

export const getTopTasks = createServerFn({ method: 'GET' }).handler(
  async () => listTopTasks(await requireUserId()),
)

export const getTask = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => getTaskById(await requireUserId(), data.id))

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => taskInputSchema.parse(d))
  .handler(async ({ data }) => createTaskRow(await requireUserId(), data))

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    taskInputSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    return updateTaskRow(await requireUserId(), id, rest)
  })

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await deleteTaskRow(await requireUserId(), data.id)
    return { ok: true as const }
  })
