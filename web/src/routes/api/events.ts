import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'

import { db } from '../../db'
import { withAuth } from '../../server/lib/http'

// Live cross-device sync (feature 9, 2026-07-21 plan): an SSE stream that
// emits an event whenever the user's data fingerprint changes, so another
// device's completion moves this browser's bar within ~a second — no
// mutation-side infra, just one cheap combined query per tick per open
// stream. The connection self-closes before the serverless duration limit;
// EventSource reconnects automatically. Polling remains as the fallback.

const TICK_MS = 1500
const HEARTBEAT_MS = 25_000
const MAX_LIFETIME_MS = 280_000

async function fingerprint(userId: string): Promise<string> {
  const res = await db.execute(sql`
    select
      coalesce((select max(updated_at)::text from tasks where user_id = ${userId}), '')
      || '|' || (select count(*)::text from tasks where user_id = ${userId})
      || '|' || (select count(*)::text from history where user_id = ${userId})
      || '|' || coalesce((select updated_at::text from user_state where user_id = ${userId}), '')
      as fp
  `)
  return String((res.rows[0] as { fp: string } | undefined)?.fp ?? '')
}

export const Route = createFileRoute('/api/events')({
  server: {
    handlers: {
      GET: withAuth(({ userId }) => {
        const encoder = new TextEncoder()
        let closed = false
        let tick: ReturnType<typeof setInterval> | undefined
        let heartbeat: ReturnType<typeof setInterval> | undefined
        let lifetime: ReturnType<typeof setTimeout> | undefined

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let last: string | null = null
            let checking = false
            const cleanup = () => {
              if (closed) return
              closed = true
              if (tick) clearInterval(tick)
              if (heartbeat) clearInterval(heartbeat)
              if (lifetime) clearTimeout(lifetime)
              try {
                controller.close()
              } catch {
                // already closed by the runtime
              }
            }
            const send = (text: string) => {
              if (closed) return
              try {
                controller.enqueue(encoder.encode(text))
              } catch {
                cleanup()
              }
            }
            send(': connected\n\n')
            tick = setInterval(() => {
              if (checking || closed) return
              checking = true
              fingerprint(userId)
                .then((fp) => {
                  if (last !== null && fp !== last) send('data: changed\n\n')
                  last = fp
                })
                .catch(() => {
                  // transient DB error — keep the stream alive, try next tick
                })
                .finally(() => {
                  checking = false
                })
            }, TICK_MS)
            heartbeat = setInterval(() => send(': hb\n\n'), HEARTBEAT_MS)
            lifetime = setTimeout(cleanup, MAX_LIFETIME_MS)
          },
          cancel() {
            closed = true
            if (tick) clearInterval(tick)
            if (heartbeat) clearInterval(heartbeat)
            if (lifetime) clearTimeout(lifetime)
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        })
      }),
    },
  },
})
