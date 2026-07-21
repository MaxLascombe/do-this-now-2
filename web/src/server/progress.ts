import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import {
  getProgressRecap as getProgressRecapLib,
  getProgressToday as getProgressTodayLib,
} from './lib/progress'
import { v, validate } from './lib/validate'

export const getProgressToday = createServerFn({ method: 'GET' })
  .inputValidator(validate(z.object({ tzOffsetMin: v.tzOffsetMin })))
  .handler(async ({ data }) =>
    getProgressTodayLib(await requireUserId(), data.tzOffsetMin),
  )

export const getProgressRecap = createServerFn({ method: 'GET' })
  .inputValidator(validate(z.object({ tzOffsetMin: v.tzOffsetMin })))
  .handler(async ({ data }) =>
    getProgressRecapLib(await requireUserId(), data.tzOffsetMin),
  )
