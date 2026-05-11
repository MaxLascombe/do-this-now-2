import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getStats } from '../../server/lib/stats'
import { getTzFromRequest, withAuth } from '../../server/lib/http'

// GET /api/stats → StatsResult
export const Route = createFileRoute('/api/stats')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId, request }) =>
        json(await getStats(userId, getTzFromRequest(request))),
      ),
    },
  },
})
