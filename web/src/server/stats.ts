import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import { getStats as getStatsLib } from './lib/stats'

export const getStats = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) =>
    z.object({ tzOffsetMin: z.number().int() }).parse(d),
  )
  .handler(async ({ data }) =>
    getStatsLib(await requireUserId(), data.tzOffsetMin),
  )
