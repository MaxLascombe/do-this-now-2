import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import { getProgressToday as getProgressTodayLib } from './lib/progress'

export const getProgressToday = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) =>
    z.object({ tzOffsetMin: z.number().int() }).parse(d),
  )
  .handler(async ({ data }) =>
    getProgressTodayLib(await requireUserId(), data.tzOffsetMin),
  )
