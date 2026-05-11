import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getHistory } from '../../server/lib/actions'
import { getTzFromRequest, withAuth } from '../../server/lib/http'

export const Route = createFileRoute('/api/history/$date')({
  server: {
    handlers: {
      GET: withAuth<{ date: string }>(async ({ userId, params, request }) =>
        json(
          await getHistory(userId, params.date, getTzFromRequest(request)),
        ),
      ),
    },
  },
})
