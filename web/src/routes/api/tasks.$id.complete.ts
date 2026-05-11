import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { completeTask } from '../../server/lib/actions'
import { unauthenticated } from '../../server/lib/http'

export const Route = createFileRoute('/api/tasks/$id/complete')({
  server: {
    handlers: {
      POST: async ({ params }: { params: { id: string } }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        return json(await completeTask(userId, params.id))
      },
    },
  },
})
