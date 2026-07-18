import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { snoozeTask, TaskNotFoundError } from '../../server/lib/actions'
import {
  invalid,
  notFound,
  readJsonBody,
  withAuth,
} from '../../server/lib/http'
import { syncLockScreenSoon } from '../../server/lib/lockscreen'

type Params = { id: string }

const idSchema = z.string().uuid()

const snoozeBodySchema = z
  .object({ allSubtasks: z.boolean().optional() })
  .optional()
  .default({})

export const Route = createFileRoute('/api/tasks/$id/snooze')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })

        const parsed = snoozeBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        try {
          const result = await snoozeTask(
            userId,
            params.id,
            parsed.data.allSubtasks ?? false,
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
