import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getProgressTodayAction } from '../../server/lib/progress'

export const Route = createFileRoute('/api/progress/today')({
  server: {
    handlers: {
      GET: async () => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        return json(await getProgressTodayAction(userId))
      },
    },
  },
})
