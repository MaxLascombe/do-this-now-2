import { createServerFn } from '@tanstack/react-start'

import { requireUserId } from './auth'
import { getProgressTodayAction } from './lib/progress'

export const getProgressToday = createServerFn({ method: 'GET' }).handler(
  async () => getProgressTodayAction(await requireUserId()),
)
