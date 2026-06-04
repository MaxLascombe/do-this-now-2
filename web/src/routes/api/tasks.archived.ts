import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { withAuth } from '../../server/lib/http'
import { listArchivedTasks } from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks/archived')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId }) => json(await listArchivedTasks(userId))),
    },
  },
})
