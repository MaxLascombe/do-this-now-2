import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { applyTimerAction } from '../../server/lib/timer'
import { invalid, notFound, withAuth } from '../../server/lib/http'
import { syncLockScreenSoon } from '../../server/lib/lockscreen'

type Params = { id: string }

const idSchema = z.string().uuid()

const timerBodySchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('start') }),
    z.object({ kind: z.literal('pause') }),
    z.object({ kind: z.literal('add'), seconds: z.number().finite() }),
    z.object({ kind: z.literal('reset') }),
  ])
  .and(z.object({ at: z.string().datetime().optional() }))

export const Route = createFileRoute('/api/tasks/$id/timer')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const raw = await request.text()
        const candidate = safeJsonParse(raw)
        if (candidate === undefined) {
          return invalid({ formErrors: ['Body must be JSON.'] })
        }
        const parsed = timerBodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        const result = await applyTimerAction(userId, params.id, parsed.data)
        syncLockScreenSoon(userId)
        return json(result)
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
