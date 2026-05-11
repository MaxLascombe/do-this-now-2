import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import { suggestEmojis as suggestEmojisLib } from './lib/emojis'
import * as tasksLib from './lib/tasks'

const idSchema = z.object({ id: z.string().uuid() })

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
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => tasksLib.getTask(await requireUserId(), data.id))

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => tasksLib.taskInputSchema.parse(d))
  .handler(async ({ data }) =>
    tasksLib.createTask(await requireUserId(), data),
  )

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        input: tasksLib.taskInputSchema,
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    tasksLib.updateTask(await requireUserId(), data.id, data.input),
  )

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => idSchema.parse(d))
  .handler(async ({ data }) => {
    await tasksLib.deleteTask(await requireUserId(), data.id)
    return {}
  })

export const suggestEmojis = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z.object({ title: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    // Auth-gate even though there's no DB write — keeps the Anthropic
    // bill scoped to authenticated users.
    await requireUserId()
    return suggestEmojisLib(data.title)
  })
