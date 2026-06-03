import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { snoozeTask, TaskNotFoundError } from '../../server/lib/actions'
import { invalid, notFound, withAuth } from '../../server/lib/http'

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
        const raw = await request.text()
        const candidate = raw.length === 0 ? {} : safeJsonParse(raw)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })

        const parsed = snoozeBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        try {
          return json(
            await snoozeTask(
              userId,
              params.id,
              parsed.data.allSubtasks ?? false,
            ),
          )
        } catch (e) {
          if (e instanceof TaskNotFoundError) return notFound()
          throw e
        }
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
