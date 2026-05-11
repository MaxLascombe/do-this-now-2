import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { ymdSchema } from '@dtn/shared/task-input'
import { requireUserId } from './auth'
import * as actionsLib from './lib/actions'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({ id: z.string().uuid(), tzOffsetMin: z.number().int() })
      .parse(d),
  )
  .handler(async ({ data }) =>
    actionsLib.completeTask(
      await requireUserId(),
      data.id,
      data.tzOffsetMin,
    ),
  )

export const snoozeTask = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        allSubtasks: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    actionsLib.snoozeTask(
      await requireUserId(),
      data.id,
      data.allSubtasks ?? false,
    ),
  )

export const getHistory = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) =>
    z
      .object({
        date: ymdSchema,
        tzOffsetMin: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ data }) =>
    actionsLib.getHistory(
      await requireUserId(),
      data.date,
      data.tzOffsetMin,
    ),
  )
