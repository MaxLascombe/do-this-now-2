import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { snoozeManyTasks } from '../../server/lib/actions'
import { invalid, withAuth } from '../../server/lib/http'

const bodySchema = z.object({ ids: z.array(z.string().uuid()).max(500) })

// POST /api/tasks/snooze-many  { ids }  → { count }
export const Route = createFileRoute('/api/tasks/snooze-many')({
  server: {
    handlers: {
      POST: withAuth(async ({ userId, request }) => {
        const raw = await request.json().catch(() => null)
        const parsed = bodySchema.safeParse(raw)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await snoozeManyTasks(userId, parsed.data.ids))
      }),
    },
  },
})
