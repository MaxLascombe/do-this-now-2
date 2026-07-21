import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { settingsInputSchema } from '@dtn/shared/settings'

import { invalid, readJsonBody, withAuth } from '../../server/lib/http'
import { getUserSettings, saveUserSettings } from '../../server/lib/settings'

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId }) => json(await getUserSettings(userId))),
      PUT: withAuth(async ({ userId, request }) => {
        const body = await readJsonBody(request)
        if (body === undefined) return invalid('malformed JSON body')
        const parsed = settingsInputSchema.safeParse(body)
        if (!parsed.success) return invalid(parsed.error.issues)
        return json(await saveUserSettings(userId, parsed.data))
      }),
    },
  },
})
