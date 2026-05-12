import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import * as actionsLib from './lib/actions'
import { v, validate } from './lib/validate'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator(
    validate(z.object({ id: v.id, tzOffsetMin: v.tzOffsetMin })),
  )
  .handler(async ({ data }) =>
    actionsLib.completeTask(
      await requireUserId(),
      data.id,
      data.tzOffsetMin,
    ),
  )

export const snoozeTask = createServerFn({ method: 'POST' })
  .inputValidator(
    validate(z.object({ id: v.id, allSubtasks: z.boolean().optional() })),
  )
  .handler(async ({ data }) =>
    actionsLib.snoozeTask(
      await requireUserId(),
      data.id,
      data.allSubtasks ?? false,
    ),
  )

export const getHistory = createServerFn({ method: 'GET' })
  .inputValidator(
    validate(z.object({ date: v.ymd, tzOffsetMin: v.tzOffsetMin })),
  )
  .handler(async ({ data }) =>
    actionsLib.getHistory(
      await requireUserId(),
      data.date,
      data.tzOffsetMin,
    ),
  )
