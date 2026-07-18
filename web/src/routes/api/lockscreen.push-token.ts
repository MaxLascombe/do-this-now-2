import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { livePushTokens } from '@dtn/shared/schema'
import { db } from '../../db'
import {
  invalid,
  readJsonBody,
  unauthenticated,
} from '../../server/lib/http'
import { authenticateDeviceToken } from '../../server/lib/lockscreen-auth'

const bodySchema = z.object({
  kind: z.enum(['start', 'update']),
  // APNs device tokens are hex; be lenient on length (Apple varies it).
  token: z.string().regex(/^[0-9a-fA-F]{16,512}$/),
})

// Device-token-authed: the phone reports its ActivityKit tokens — the
// app-wide push-to-start token and, whenever an activity starts, that
// activity's update token. One row per (device, kind): a new activity's
// token replaces the previous one.
export const Route = createFileRoute('/api/lockscreen/push-token')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const device = await authenticateDeviceToken(request)
        if (!device) return unauthenticated()
        const candidate = await readJsonBody(request)
        if (candidate === undefined)
          return invalid({ formErrors: ['Body must be JSON.'] })
        const parsed = bodySchema.safeParse(candidate)
        if (!parsed.success) return invalid(parsed.error.flatten())

        await db
          .insert(livePushTokens)
          .values({
            userId: device.userId,
            deviceId: device.deviceId,
            kind: parsed.data.kind,
            token: parsed.data.token.toLowerCase(),
          })
          .onConflictDoUpdate({
            target: [livePushTokens.deviceId, livePushTokens.kind],
            set: {
              token: parsed.data.token.toLowerCase(),
              updatedAt: new Date(),
              // A fresh start token (app open / reinstall) invalidates any
              // pending-start stamp aimed at the token it replaces —
              // without this, a stale stamp mutes push-to-start for the
              // whole cooldown after a reinstall.
              ...(parsed.data.kind === 'start' ? { startSentAt: null } : {}),
            },
          })
        // An update token IS the ack that a pushed-to-start activity is
        // live — clear the device's pending-start stamp so a future
        // selection can push-to-start again after this activity ends.
        if (parsed.data.kind === 'update') {
          await db
            .update(livePushTokens)
            .set({ startSentAt: null })
            .where(
              and(
                eq(livePushTokens.deviceId, device.deviceId),
                eq(livePushTokens.kind, 'start'),
              ),
            )
        }
        return json({ ok: true })
      },
    },
  },
})
