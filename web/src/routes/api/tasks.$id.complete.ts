import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { completeTask } from '../../server/lib/actions'
import { withAuth } from '../../server/lib/http'

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: withAuth<{ id: string }>(async ({ userId, params }) =>
        json(await completeTask(userId, params.id)),
      ),
    },
  },
})
