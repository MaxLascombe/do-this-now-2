import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { ymdSchema } from '@dtn/shared/task-input'
import { getHistory } from '../../server/lib/actions'
import { getTzFromRequest, invalid, withAuth } from '../../server/lib/http'

type Params = { date: string }

export const Route = createFileRoute('/api/history/$date')({
  server: {
    handlers: {
      GET: withAuth<Params>(async ({ userId, params, request }) => {
        const parsed = ymdSchema.safeParse(params.date)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(
          await getHistory(userId, parsed.data, getTzFromRequest(request)),
        )
      }),
    },
  },
})
