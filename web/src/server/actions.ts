import { createServerFn } from '@tanstack/react-start'

import { requireUserId } from './auth'
import * as actionsLib from './lib/actions'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) =>
    actionsLib.completeTask(await requireUserId(), data.id),
  )

export const snoozeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; allSubtasks?: boolean }) => d)
  .handler(async ({ data }) =>
    actionsLib.snoozeTask(
      await requireUserId(),
      data.id,
      data.allSubtasks ?? false,
    ),
  )

export const getHistory = createServerFn({ method: 'GET' })
  .inputValidator((d: { date: string; tzOffsetMin: number }) => d)
  .handler(async ({ data }) =>
    actionsLib.getHistory(
      await requireUserId(),
      data.date,
      data.tzOffsetMin,
    ),
  )
