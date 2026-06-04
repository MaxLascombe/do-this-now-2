import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { notFound, withAuth } from '../../server/lib/http'
import { archiveTask } from '../../server/lib/tasks'

type Params = { id: string }

const idSchema = z.string().uuid()

export const Route = createFileRoute('/api/tasks/$id/archive')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        return json(await archiveTask(userId, params.id))
      }),
    },
  },
})
