import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getTzFromRequest, withAuth } from '../../server/lib/http'
import { listTopTasks } from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks/top')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId, request }) =>
        json(await listTopTasks(userId, getTzFromRequest(request))),
      ),
    },
  },
})
