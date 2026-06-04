import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import * as actionsLib from './lib/actions'
import { applyTimerAction } from './lib/timer'
import { v, validate } from './lib/validate'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator(
    validate(
      z.object({
        id: v.id,
        tzOffsetMin: v.tzOffsetMin,
        countMeasurement: z.boolean().optional(),
      }),
    ),
  )
  .handler(async ({ data }) =>
    actionsLib.completeTask(
      await requireUserId(),
      data.id,
      data.tzOffsetMin,
      data.countMeasurement ?? true,
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

export const unsnoozeTask = createServerFn({ method: 'POST' })
  .inputValidator(validate(z.object({ id: v.id })))
  .handler(async ({ data }) =>
    actionsLib.unsnoozeTask(await requireUserId(), data.id),
  )

const timerActionSchema = z
  .discriminatedUnion('kind', [
    z.object({ kind: z.literal('start') }),
    z.object({ kind: z.literal('pause') }),
    z.object({ kind: z.literal('add'), seconds: z.number().finite() }),
    z.object({ kind: z.literal('reset') }),
  ])
  .and(z.object({ at: z.string().datetime().optional() }))

export const taskTimer = createServerFn({ method: 'POST' })
  .inputValidator(
    validate(z.object({ id: v.id, action: timerActionSchema })),
  )
  .handler(async ({ data }) =>
    applyTimerAction(await requireUserId(), data.id, data.action),
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
