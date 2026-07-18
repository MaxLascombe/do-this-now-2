import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import {
  invalid,
  notFound,
  readJsonBody,
  withAuth,
} from '../../server/lib/http'
import { syncLockScreenSoon } from '../../server/lib/lockscreen'
import {
  deleteTask,
  getTask,
  taskInputSchema,
  updateTask,
} from '../../server/lib/tasks'

type Params = { id: string }

const idSchema = z.string().uuid()

export const Route = createFileRoute('/api/tasks/$id')({
  server: {
    handlers: {
      GET: withAuth<Params>(async ({ userId, params }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const task = await getTask(userId, params.id)
        if (!task) return notFound()
        return json(task)
      }),
      PUT: withAuth<Params>(async ({ userId, params, request }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const body = await readJsonBody(request)
        if (body === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })
        const parsed = taskInputSchema.safeParse(body)
        if (!parsed.success) return invalid(parsed.error.flatten())
        const updated = await updateTask(userId, params.id, parsed.data)
        if (!updated) return notFound()
        // Edits to the Selected Task's title/emoji/target refresh its
        // lock-screen face.
        syncLockScreenSoon(userId)
        return json(updated)
      }),
      DELETE: withAuth<Params>(async ({ userId, params }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        await deleteTask(userId, params.id)
        // Deleting the Selected Task clears the pointer via the FK with no
        // app code — this is the only hook that ends its activity.
        syncLockScreenSoon(userId)
        return json({})
      }),
    },
  },
})
