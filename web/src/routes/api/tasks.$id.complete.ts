import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { completeTask, TaskNotFoundError } from '../../server/lib/actions'
import {
  getTzFromRequest,
  invalid,
  notFound,
  readJsonBody,
  withAuth,
} from '../../server/lib/http'
import { syncLockScreenSoon } from '../../server/lib/lockscreen'

type Params = { id: string }

const idSchema = z.string().uuid()

const completeBodySchema = z
  .object({ countMeasurement: z.boolean().optional() })
  .optional()
  .default({})

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })

        const parsed = completeBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        try {
          const result = await completeTask(
            userId,
            params.id,
            getTzFromRequest(request),
            parsed.data.countMeasurement ?? true,
          )
          syncLockScreenSoon(userId)
          return json(result)
        } catch (e) {
          if (e instanceof TaskNotFoundError) return notFound()
          throw e
        }
      }),
    },
  },
})
