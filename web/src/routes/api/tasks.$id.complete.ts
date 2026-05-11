import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { completeTask } from '../../server/lib/actions'
import { getTzFromRequest, withAuth } from '../../server/lib/http'

type Params = { id: string }

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) =>
        json(
          await completeTask(userId, params.id, getTzFromRequest(request)),
        ),
      ),
    },
  },
})
