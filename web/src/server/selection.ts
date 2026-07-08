import { createServerFn } from '@tanstack/react-start'

import { requireUserId } from './auth'
import { unselect as unselectLib } from './lib/actions'
import { getSelection as getSelectionLib } from './lib/selection'

export const getSelection = createServerFn({ method: 'GET' }).handler(
  async () => getSelectionLib(await requireUserId()),
)

export const unselect = createServerFn({ method: 'POST' }).handler(async () =>
  unselectLib(await requireUserId()),
)
