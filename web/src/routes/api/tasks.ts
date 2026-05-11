import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { invalid, withAuth } from '../../server/lib/http'
import {
  createTask,
  listTasks,
  taskInputSchema,
} from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId }) => json(await listTasks(userId))),
      POST: withAuth(async ({ userId, request }) => {
        const parsed = taskInputSchema.safeParse(await request.json())
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await createTask(userId, parsed.data))
      }),
    },
  },
})
