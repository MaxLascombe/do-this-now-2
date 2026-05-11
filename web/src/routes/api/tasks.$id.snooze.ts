import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { snoozeTask } from '../../server/lib/actions'

export const Route = createFileRoute('/api/tasks/$id/snooze')({
  server: {
    handlers: {
      POST: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        let allSubtasks = false
        try {
          const body = (await request.json()) as { allSubtasks?: boolean }
          allSubtasks = Boolean(body?.allSubtasks)
        } catch {
          // no body, use default
        }
        return json(await snoozeTask(userId, params.id, allSubtasks))
      },
    },
  },
})
