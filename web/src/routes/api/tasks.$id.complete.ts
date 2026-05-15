import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { completeTask } from '../../server/lib/actions'
import { getTzFromRequest, withAuth } from '../../server/lib/http'

type Params = { id: string }

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        let countMeasurement = true
        try {
          const body = (await request.json()) as { countMeasurement?: boolean }
          if (typeof body?.countMeasurement === 'boolean')
            countMeasurement = body.countMeasurement
        } catch {
          // No body / non-JSON — keep default true.
        }
        return json(
          await completeTask(
            userId,
            params.id,
            getTzFromRequest(request),
            countMeasurement,
          ),
        )
      }),
    },
  },
})
