import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { invalid, notFound, unauthenticated } from '../../server/lib/http'
import {
  deleteTask,
  getTask,
  taskInputSchema,
  updateTask,
} from '../../server/lib/tasks'

export const Route = createFileRoute('/api/tasks/$id')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        const task = await getTask(userId, params.id)
        if (!task) return notFound()
        return json(task)
      },
      PUT: async ({
        request,
        params,
      }: {
        request: Request
        params: { id: string }
      }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        const parsed = taskInputSchema.safeParse(await request.json())
        if (!parsed.success) return invalid(parsed.error.flatten())
        const updated = await updateTask(userId, params.id, parsed.data)
        if (!updated) return notFound()
        return json(updated)
      },
      DELETE: async ({ params }: { params: { id: string } }) => {
        const { userId } = await auth()
        if (!userId) return unauthenticated()
        await deleteTask(userId, params.id)
        return json({})
      },
    },
  },
})
