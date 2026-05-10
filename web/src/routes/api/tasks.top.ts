import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { listTopTasks } from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks/top')({
  server: {
    handlers: {
      GET: async () => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        return json(await listTopTasks(userId))
      },
    },
  },
})
