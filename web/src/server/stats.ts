import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { requireUserId } from './auth'
import { getStats as getStatsLib } from './lib/stats'
import { v, validate } from './lib/validate'

export const getStats = createServerFn({ method: 'GET' })
  .inputValidator(validate(z.object({ tzOffsetMin: v.tzOffsetMin })))
  .handler(async ({ data }) =>
    getStatsLib(await requireUserId(), data.tzOffsetMin),
  )
