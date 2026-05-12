import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import { suggestEmojis as suggestEmojisLib } from './lib/emojis'
import * as tasksLib from './lib/tasks'
import { v, validate } from './lib/validate'

export const listTasks = createServerFn({ method: 'GET' }).handler(
  async () => tasksLib.listTasks(await requireUserId()),
)

export const listTopTasks = createServerFn({ method: 'GET' })
  .inputValidator(validate(z.object({ tzOffsetMin: v.tzOffsetMin })))
  .handler(async ({ data }) =>
    tasksLib.listTopTasks(await requireUserId(), data.tzOffsetMin),
  )

export const getTask = createServerFn({ method: 'GET' })
  .inputValidator(validate(z.object({ id: v.id })))
  .handler(async ({ data }) => tasksLib.getTask(await requireUserId(), data.id))

export const createTask = createServerFn({ method: 'POST' })
  .inputValidator(validate(tasksLib.taskInputSchema))
  .handler(async ({ data }) =>
    tasksLib.createTask(await requireUserId(), data),
  )

export const updateTask = createServerFn({ method: 'POST' })
  .inputValidator(
    validate(z.object({ id: v.id, input: tasksLib.taskInputSchema })),
  )
  .handler(async ({ data }) =>
    tasksLib.updateTask(await requireUserId(), data.id, data.input),
  )

export const deleteTask = createServerFn({ method: 'POST' })
  .inputValidator(validate(z.object({ id: v.id })))
  .handler(async ({ data }) => {
    await tasksLib.deleteTask(await requireUserId(), data.id)
    return {}
  })

export const suggestEmojis = createServerFn({ method: 'POST' })
  .inputValidator(validate(z.object({ title: z.string().min(1).max(500) })))
  .handler(async ({ data }) => {
    // Auth-gate even though there's no DB write — keeps the Anthropic
    // bill scoped to authenticated users.
    await requireUserId()
    return suggestEmojisLib(data.title)
  })
