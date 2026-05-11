import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { unauthenticated } from '../../server/lib/http'
import { listTopTasks } from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks/top')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        const url = new URL(request.url)
        const tz = parseInt(url.searchParams.get('tzOffsetMin') ?? '0', 10)
        return json(await listTopTasks(userId, tz))
      },
    },
  },
})
