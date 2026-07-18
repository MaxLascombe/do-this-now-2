import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { issueDeviceToken } from '../../server/lib/lockscreen-auth'
import { invalid, readJsonBody, withAuth } from '../../server/lib/http'

const bodySchema = z.object({ label: z.string().max(80).nullish() })

// Clerk-authed (the app calls this once per install): mints the long-lived
// device secret the widget uses for everything else. The raw token is
// returned exactly once; only its hash is stored.
export const Route = createFileRoute('/api/lockscreen/device')({
  server: {
    handlers: {
      POST: withAuth(async ({ userId, request }) => {
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })
        const parsed = bodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await issueDeviceToken(userId, parsed.data.label ?? null))
      }),
    },
  },
})
