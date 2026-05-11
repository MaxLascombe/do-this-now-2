import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getTzFromRequest, withAuth } from '../../server/lib/http'
import { getProgressToday } from '../../server/lib/progress'

export const Route = createFileRoute('/api/progress/today')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId, request }) =>
        json(await getProgressToday(userId, getTzFromRequest(request))),
      ),
    },
  },
})
