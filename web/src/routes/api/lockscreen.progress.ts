import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getTzFromRequest, unauthenticated } from '../../server/lib/http'
import { authenticateDeviceToken } from '../../server/lib/lockscreen-auth'
import { getProgressToday } from '../../server/lib/progress'

// Device-token-authed twin of /api/progress/today: the lock-screen progress
// widget runs in the widget extension, which can't refresh Clerk JWTs.
export const Route = createFileRoute('/api/lockscreen/progress')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const device = await authenticateDeviceToken(request)
        if (!device) return unauthenticated()
        return json(
          await getProgressToday(device.userId, getTzFromRequest(request)),
        )
      },
    },
  },
})
