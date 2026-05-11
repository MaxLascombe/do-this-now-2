import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { getHistory } from '../../server/lib/actions'

export const Route = createFileRoute('/api/history/$date')({
  server: {
    handlers: {
      GET: async ({
        params,
        request,
      }: {
        params: { date: string }
        request: Request
      }) => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        const url = new URL(request.url)
        const tz = parseInt(url.searchParams.get('tzOffsetMin') ?? '0', 10)
        return json(await getHistory(userId, params.date, tz))
      },
    },
  },
})
