import { createServerFn } from '@tanstack/react-start'

import { requireUserId } from './auth'
import {
  completeTaskAction,
  getHistoryForDateAction,
  snoozeTaskAction,
} from './lib/actions'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) =>
    completeTaskAction(await requireUserId(), data.id),
  )

export const snoozeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; allSubtasks?: boolean }) => d)
  .handler(async ({ data }) =>
    snoozeTaskAction(
      await requireUserId(),
      data.id,
      data.allSubtasks ?? false,
    ),
  )

export const getHistoryForDate = createServerFn({ method: 'GET' })
  .inputValidator((d: { date: string; tzOffsetMin: number }) => d)
  .handler(async ({ data }) =>
    getHistoryForDateAction(
      await requireUserId(),
      data.date,
      data.tzOffsetMin,
    ),
  )
