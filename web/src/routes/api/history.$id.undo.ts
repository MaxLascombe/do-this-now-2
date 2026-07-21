import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { TaskNotFoundError, uncompleteTask } from '../../server/lib/actions'
import { getTzFromRequest, notFound, withAuth } from '../../server/lib/http'

export const Route = createFileRoute('/api/history/$id/undo')({
  server: {
    handlers: {
      POST: withAuth<{ id: string }>(async ({ userId, params, request }) => {
        try {
          return json(
            await uncompleteTask(userId, params.id, getTzFromRequest(request)),
          )
        } catch (err) {
          if (err instanceof TaskNotFoundError) return notFound(err.message)
          throw err
        }
      }),
    },
  },
})
