import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { invalid, unauthenticated } from '../../server/lib/http'
import {
  createTask,
  listTasks,
  taskInputSchema,
} from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks')({
  server: {
    handlers: {
      GET: async () => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        return json(await listTasks(userId))
      },
      POST: async ({ request }: { request: Request }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        const parsed = taskInputSchema.safeParse(await request.json())
        if (!parsed.success) return invalid(parsed.error.flatten())
        return json(await createTask(userId, parsed.data))
      },
    },
  },
})
