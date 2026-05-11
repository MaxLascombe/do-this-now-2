import { auth } from '@clerk/tanstack-react-start/server'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

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
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        const task = await getTask(userId, params.id)
        if (!task) return json({ error: 'not found' }, { status: 404 })
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
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        const body = await request.json()
        const parsed = taskInputSchema.safeParse(body)
        if (!parsed.success)
          return json(
            { error: 'invalid', details: parsed.error.flatten() },
            { status: 400 },
          )
        const updated = await updateTask(userId, params.id, parsed.data)
        if (!updated) return json({ error: 'not found' }, { status: 404 })
        return json(updated)
      },
      DELETE: async ({ params }: { params: { id: string } }) => {
        const { userId } = await auth()
        if (!userId) return json({ error: 'unauthenticated' }, { status: 401 })
        await deleteTask(userId, params.id)
        return json({ ok: true })
      },
    },
  },
})
