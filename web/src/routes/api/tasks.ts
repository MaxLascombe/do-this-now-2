import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import {
  createTask,
  listTasks,
  taskInputSchema,
} from '../../server/lib/tasks'

async function userIdOr401() {
  const { userId } = await auth()
  if (!userId) return null
  return userId
}

export const Route = createFileRoute('/api/tasks')({
  server: {
    handlers: {
      GET: async () => {
        const userId = await userIdOr401()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        return json(await listTasks(userId))
      },
      POST: async ({ request }: { request: Request }) => {
        const userId = await userIdOr401()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        const body = await request.json()
        const parsed = taskInputSchema.safeParse(body)
        if (!parsed.success)
          return json({ error: 'invalid', details: parsed.error.flatten() }, { status: 400 })
        return json(await createTask(userId, parsed.data))
      },
    },
  },
})
