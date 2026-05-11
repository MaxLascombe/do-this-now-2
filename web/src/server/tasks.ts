import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import * as tasksLib from './lib/tasks'

export const listTasks = createServerFn({ method: 'GET' }).handler(
  async () => tasksLib.listTasks(await requireUserId()),
)

export const listTopTasks = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) =>
    z.object({ tzOffsetMin: z.number().int() }).parse(d),
  )
  .handler(async ({ data }) =>
    tasksLib.listTopTasks(await requireUserId(), data.tzOffsetMin),
  )

export const getTask = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => tasksLib.getTask(await requireUserId(), data.id))

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => tasksLib.taskInputSchema.parse(d))
  .handler(async ({ data }) =>
    tasksLib.createTask(await requireUserId(), data),
  )

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    tasksLib.taskInputSchema.extend({ id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data
    return tasksLib.updateTask(await requireUserId(), id, rest)
  })

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await tasksLib.deleteTask(await requireUserId(), data.id)
    return { ok: true as const }
  })
