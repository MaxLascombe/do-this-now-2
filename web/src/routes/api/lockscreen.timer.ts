import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import {
  getTzFromRequest,
  invalid,
  readJsonBody,
  unauthenticated,
} from '../../server/lib/http'
import { authenticateDeviceToken } from '../../server/lib/lockscreen-auth'
import { runWithLockScreenOrigin } from '../../server/lib/lockscreen-origin'
import { applyLockScreenTimerAction } from '../../server/lib/lockscreen-timer'

const bodySchema = z.object({
  action: z.enum(['pause', 'resume']),
  at: z.string().datetime().optional(),
})

// Device-token-authed: the widget's Pause/Resume. Acts on whatever is
// currently Selected (the widget never names a task — the server is the
// authority), returns the fresh lock-screen state (null = no activity).
export const Route = createFileRoute('/api/lockscreen/timer')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const device = await authenticateDeviceToken(request)
        if (!device) return unauthenticated()
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })
        const parsed = bodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        const state = await runWithLockScreenOrigin(
          { deviceId: device.deviceId },
          () =>
            applyLockScreenTimerAction(
              device.userId,
              parsed.data,
              getTzFromRequest(request),
            ),
        )
        return json({ state })
      },
    },
  },
})
