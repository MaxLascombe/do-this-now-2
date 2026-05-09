import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getHistoryForDateAction } from '../../server/lib/actions'

export const Route = createFileRoute('/api/history/$date')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { date: string } }) => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        return json(await getHistoryForDateAction(userId, params.date))
      },
    },
  },
})
