import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getProgressTodayAction } from '../../server/lib/progress'

export const Route = createFileRoute('/api/progress/today')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        const url = new URL(request.url)
        const tzOffsetMin = parseInt(url.searchParams.get('tzOffsetMin') ?? '0')
        return json(
          await getProgressTodayAction(
            userId,
            Number.isFinite(tzOffsetMin) ? tzOffsetMin : 0,
          ),
        )
      },
    },
  },
})
