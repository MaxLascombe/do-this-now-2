import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'

import { tasks } from '@dtn/shared/schema'
import { db } from '../../../db'
import { bulkPickEmoji } from '../../../server/lib/emojis'
import { withAuth } from '../../../server/lib/http'

// One-shot upgrade: every task still carrying the default '📝' gets a
// Claude-picked emoji. Idempotent — re-running after another batch of
// new tasks have crept in is fine. Auth-scoped to the calling user so
// you can only backfill your own tasks.
//
// Curl:
//   curl -X POST https://<host>/api/admin/backfill-emojis \
//     -H "Authorization: Bearer <clerk session token>"

const BATCH_SIZE = 25

export const Route = createFileRoute('/api/admin/backfill-emojis')({
  server: {
    handlers: {
      POST: withAuth(async ({ userId }) => {
        const placeholder = '📝'
        const rows = await db
          .select({ id: tasks.id, title: tasks.title })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), eq(tasks.emoji, placeholder)))

        let updated = 0
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE)
          const picks = await bulkPickEmoji(batch.map((r) => r.title))
          // One UPDATE per row; the batch already amortizes the Claude call,
          // and these are small writes against an indexed PK.
          for (let j = 0; j < batch.length; j++) {
            const emoji = picks[j] ?? placeholder
            if (emoji === placeholder) continue
            await db
              .update(tasks)
              .set({ emoji, updatedAt: new Date() })
              .where(and(eq(tasks.userId, userId), eq(tasks.id, batch[j].id)))
            updated++
          }
        }

        return json({ updated, scanned: rows.length })
      }),
    },
  },
})
