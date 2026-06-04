import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { z } from 'zod'

import { skipTask, TaskNotFoundError } from '../../server/lib/actions'
import { notFound, withAuth } from '../../server/lib/http'

type Params = { id: string }

const idSchema = z.string().uuid()

export const Route = createFileRoute('/api/tasks/$id/skip')({
  server: {
    handlers: {
      POST: withAuth<Params>(async ({ userId, params }) => {
        if (!idSchema.safeParse(params.id).success) return notFound()
        try {
          return json(await skipTask(userId, params.id))
        } catch (e) {
          if (e instanceof TaskNotFoundError) return notFound()
          throw e
        }
      }),
    },
  },
})
