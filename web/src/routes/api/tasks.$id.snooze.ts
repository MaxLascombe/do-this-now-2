import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { snoozeTask } from '../../server/lib/actions'
import { invalid, withAuth } from '../../server/lib/http'

type Params = { id: string }

const snoozeBodySchema = z
  .object({ allSubtasks: z.boolean().optional() })
  .optional()
  .default({})

export const Route = createFileRoute('/api/tasks/$id/snooze')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        const raw = await request.text()
        const candidate = raw.length === 0 ? {} : safeJsonParse(raw)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })

        const parsed = snoozeBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(
          await snoozeTask(userId, params.id, parsed.data.allSubtasks ?? false),
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
