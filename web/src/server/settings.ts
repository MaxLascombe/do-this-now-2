import { createServerFn } from '@tanstack/react-start'

import { settingsInputSchema } from '@dtn/shared/settings'

import { requireUserId } from './auth'
import { getUserSettings, saveUserSettings } from './lib/settings'
import { validate } from './lib/validate'

export const getSettings = createServerFn({ method: 'GET' }).handler(async () =>
  getUserSettings(await requireUserId()),
)

export const updateSettings = createServerFn({ method: 'POST' })
  .inputValidator(validate(settingsInputSchema))
  .handler(async ({ data }) => saveUserSettings(await requireUserId(), data))
