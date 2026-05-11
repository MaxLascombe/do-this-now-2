import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getTzFromRequest, invalid, withAuth } from '../../server/lib/http'
import {
  createTask,
  listTasks,
  listTopTasks,
  taskInputSchema,
} from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId, request }) => {
        // ?sort=top routes to the priority-sorted list; otherwise return
        // the full unsorted set.
        const url = new URL(request.url)
        if (url.searchParams.get('sort') === 'top') {
          return json(await listTopTasks(userId, getTzFromRequest(request)))
        }
        return json(await listTasks(userId))
      }),
      POST: withAuth(async ({ userId, request }) => {
        const parsed = taskInputSchema.safeParse(await request.json())
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await createTask(userId, parsed.data))
      }),
    },
  },
})
