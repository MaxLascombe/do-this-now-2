import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getTzFromRequest, withAuth } from '../../server/lib/http'
import { getProgressRecap } from '../../server/lib/progress'

export const Route = createFileRoute('/api/progress/recap')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId, request }) =>
        json(await getProgressRecap(userId, getTzFromRequest(request))),
      ),
    },
  },
})
