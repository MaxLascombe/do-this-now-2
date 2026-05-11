import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { suggestEmojis } from '../../server/lib/emojis'
import { invalid, withAuth } from '../../server/lib/http'

const bodySchema = z.object({ title: z.string().min(1).max(500) })

// POST /api/tasks/suggest-emojis  { title }  → string[]  (up to 5 emoji)
export const Route = createFileRoute('/api/tasks/suggest-emojis')({
  server: {
    handlers: {
      POST: withAuth(async ({ request }) => {
        const raw = await request.json().catch(() => null)
        const parsed = bodySchema.safeParse(raw)
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await suggestEmojis(parsed.data.title))
      }),
    },
  },
})
