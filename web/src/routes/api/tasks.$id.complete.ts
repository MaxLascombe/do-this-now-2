import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { completeTask } from '../../server/lib/actions'
import { getTzFromRequest, invalid, withAuth } from '../../server/lib/http'

type Params = { id: string }

const completeBodySchema = z
  .object({ countMeasurement: z.boolean().optional() })
  .optional()
  .default({})

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        const raw = await request.text()
        const candidate = raw.length === 0 ? {} : safeJsonParse(raw)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })

        const parsed = completeBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(
          await completeTask(
            userId,
            params.id,
            getTzFromRequest(request),
            parsed.data?.countMeasurement ?? true,
          ),
        )
      }),
    },
  },
})

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return undefined
  }
}
