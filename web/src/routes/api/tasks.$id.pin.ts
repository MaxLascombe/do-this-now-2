import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { setPinned } from '../../server/lib/tasks'
import { invalid, notFound, readJsonBody, withAuth } from '../../server/lib/http'

type Params = { id: string }

const idSchema = z.string().uuid()
const bodySchema = z.object({ pinned: z.boolean() })

export const Route = createFileRoute('/api/tasks/$id/pin')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params, request }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })
        const parsed = bodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())
        const task = await setPinned(userId, params.id, parsed.data.pinned)
        if (!task) return notFound()
        return json(task)
      }),
    },
  },
})
