import { waitUntil } from '@vercel/functions'
import { and, eq, isNull, lt, or } from 'drizzle-orm'

import { livePushTokens, tasks } from '@dtn/shared/schema'
import { db } from '../../db'
import {
  ApnsError,
  apnsConfigured,
  sendBackgroundPush,
  sendLiveActivityPush,
  tokenDigest,
} from './apns'
import { deviceIdForToken } from './lockscreen-auth'
import { getLockScreenOrigin, type LockScreenOrigin } from './lockscreen-origin'
import { getSelection } from './selection'
import type { Task } from '@dtn/shared/schema'

// Must equal the Swift ActivityAttributes struct name — ActivityKit uses it
// to route a push-to-start to the right activity type.
export const ATTRIBUTES_TYPE = 'LockScreenTimerAttributes'

// The Lock Screen Timer's content. Mirrors the Swift ContentState field for
// field; startedAt travels as epoch seconds so no Date-decoding strategy can
// disagree between JSONDecoder and us.
export type LockScreenState = {
  taskId: string
  title: string
  emoji: string
  running: boolean
  startedAtEpoch: number | null
  accumulatedSeconds: number
  targetMinutes: number
}

async function loadTask(userId: string, id: string): Promise<Task | null> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ?? null
}

// Current truth for the lock screen: the Selected Task's face over its
// resolved (Child→Keeper) timer. Null when nothing is Selected — the
// activity should not exist.
export async function buildLockScreenState(
  userId: string,
): Promise<LockScreenState | null> {
  const { selectedTaskId } = await getSelection(userId)
  if (!selectedTaskId) return null
  const selected = await loadTask(userId, selectedTaskId)
  if (!selected) return null
  const timerTask = selected.timekeeperId
    ? await loadTask(userId, selected.timekeeperId)
    : selected
  if (!timerTask) return null
  return {
    taskId: selected.id,
    title: selected.title,
    emoji: selected.emoji,
    running: timerTask.timerStartedAt !== null,
    startedAtEpoch: timerTask.timerStartedAt
      ? timerTask.timerStartedAt.getTime() / 1000
      : null,
    accumulatedSeconds: timerTask.timerAccumulatedSeconds,
    targetMinutes: Math.ceil(timerTask.timeFrame),
  }
}

async function dropToken(id: string): Promise<void> {
  await db.delete(livePushTokens).where(eq(livePushTokens.id, id))
}

// Every start push makes iOS create a NEW activity, so a device must not
// receive a second one until the first was acknowledged (its update token
// registered) — otherwise a pause right after a push-to-start duplicates
// the activity. The cooldown bounds the damage if the ack never arrives.
export const START_ACK_COOLDOWN_MS = 15 * 60 * 1000

// Pure decision — unit-tested: push-to-start iff the device has no live
// activity AND no unacknowledged start within the cooldown.
export function shouldSendStart(
  row: { deviceId: string; startSentAt: Date | null },
  devicesWithActivity: Set<string>,
  now: Date,
): boolean {
  if (devicesWithActivity.has(row.deviceId)) return false
  if (
    row.startSentAt &&
    now.getTime() - row.startSentAt.getTime() < START_ACK_COOLDOWN_MS
  )
    return false
  return true
}

async function sendOrPrune(
  row: { id: string; token: string },
  push: Parameters<typeof sendLiveActivityPush>[1],
): Promise<'sent' | 'pruned' | 'failed'> {
  try {
    await sendLiveActivityPush(row.token, push)
    return 'sent'
  } catch (err) {
    // 410 Unregistered / 400 BadDeviceToken = the token will never work
    // again (activity ended, app reinstalled) — drop the row. Anything else
    // (network, throttle) is transient: log and keep the token.
    if (
      err instanceof ApnsError &&
      (err.status === 410 || err.reason === 'BadDeviceToken')
    ) {
      await dropToken(row.id)
      return 'pruned'
    }
    console.error(
      `lockscreen push failed (token ${tokenDigest(row.token)})`,
      err,
    )
    return 'failed'
  }
}

// Background wake for the progress widget; dead tokens are pruned like the
// activity ones, other failures only logged (it's a hint, not state).
async function sendWakeOrPrune(row: {
  id: string
  token: string
}): Promise<void> {
  try {
    await sendBackgroundPush(row.token)
  } catch (err) {
    if (
      err instanceof ApnsError &&
      (err.status === 410 || err.reason === 'BadDeviceToken')
    ) {
      await dropToken(row.id)
      return
    }
    console.error(
      `lockscreen wake push failed (token ${tokenDigest(row.token)})`,
      err,
    )
  }
}

// Atomic claim: only the sync whose UPDATE actually flips the stamp sends.
// Two concurrent syncs both see a stale SELECT; the conditional write makes
// the loser skip instead of double-starting.
async function claimStart(rowId: string, now: Date): Promise<boolean> {
  const claimed = await db
    .update(livePushTokens)
    .set({ startSentAt: now })
    .where(
      and(
        eq(livePushTokens.id, rowId),
        or(
          isNull(livePushTokens.startSentAt),
          lt(
            livePushTokens.startSentAt,
            new Date(now.getTime() - START_ACK_COOLDOWN_MS),
          ),
        ),
      ),
    )
    .returning({ id: livePushTokens.id })
  return claimed.length > 0
}

// Route-side hook: never awaited by (or able to fail) the mutation. On
// Vercel the response would otherwise freeze the function and kill the
// pushes mid-flight (observed as "APNs 0" / TLS cancels / dropped DB
// connections in prod) — waitUntil keeps the instance alive until the sync
// settles. Outside Vercel it's a no-op and the promise just floats.
export const syncLockScreenSoon = (userId: string): void => {
  // Read the ALS synchronously — the store is gone once the handler returns.
  const origin = getLockScreenOrigin()
  waitUntil(
    syncLockScreen(userId, origin).catch((err) =>
      console.error('syncLockScreen failed', err),
    ),
  )
}

// Mirror the user's current state onto every registered phone.
//
// Per device: an 'update' token means an activity is live there — update it
// in place (also how a Selected-Task switch lands, per the update-in-place
// decision). If that token turns out dead (app reinstalled, activity gone),
// fall through to a push-to-start in the SAME pass instead of losing an
// action to the pruning. A device with only a 'start' token gets a
// push-to-start, gated by the ack/cooldown claim. When nothing is Selected,
// end every live activity and forget its update token (a fresh one arrives
// when the next activity starts).
export async function syncLockScreen(
  userId: string,
  origin: LockScreenOrigin | null = null,
): Promise<void> {
  if (!apnsConfigured()) return
  const [state, tokens, originDeviceId] = await Promise.all([
    buildLockScreenState(userId),
    db.select().from(livePushTokens).where(eq(livePushTokens.userId, userId)),
    origin?.deviceId
      ? Promise.resolve(origin.deviceId)
      : origin?.deviceToken
        ? deviceIdForToken(userId, origin.deviceToken)
        : Promise.resolve(null),
  ])
  const updates = tokens.filter((t) => t.kind === 'update')

  // Every sync means something changed — nudge other devices' backgrounded
  // apps to refresh the progress widget. The origin device's app is in the
  // foreground and reloads its own timeline.
  const wakes = Promise.all(
    tokens
      .filter((t) => t.kind === 'device' && t.deviceId !== originDeviceId)
      .map(sendWakeOrPrune),
  )

  if (state === null) {
    await Promise.all(
      updates
        .filter((row) => row.deviceId !== originDeviceId)
        .map(async (row) => {
          const outcome = await sendOrPrune(row, {
            event: 'end',
            contentState: {},
            dismissalDate: new Date(),
          })
          // keep the token on transient failure so the next sync retries
          // the end ('pruned' already dropped it inside sendOrPrune)
          if (outcome === 'sent') await dropToken(row.id)
        }),
    )
    await wakes
    return
  }

  const contentState = state as unknown as Record<string, unknown>
  const now = new Date()
  const deviceIds = [...new Set(tokens.map((t) => t.deviceId))]
  await Promise.all(
    deviceIds.map(async (deviceId) => {
      // The origin device mirrors every change locally (ADR-0006); a push
      // at it would just replay the update animation as a stutter.
      if (deviceId === originDeviceId) return
      const update = updates.find((t) => t.deviceId === deviceId)
      if (update) {
        const outcome = await sendOrPrune(update, {
          event: 'update',
          contentState,
        })
        if (outcome !== 'pruned') return
      }
      const start = tokens.find(
        (t) => t.deviceId === deviceId && t.kind === 'start',
      )
      if (!start) return
      // The origin device mirrors state onto its activity locally — a
      // push-to-start would duplicate it (updates/ends still flow).
      const withActivity = originDeviceId
        ? new Set([originDeviceId])
        : new Set<string>()
      if (!shouldSendStart(start, withActivity, now)) return
      if (!(await claimStart(start.id, now))) return
      await sendOrPrune(start, {
        event: 'start',
        contentState,
        attributesType: ATTRIBUTES_TYPE,
        attributes: {},
      })
    }),
  )
  await wakes
}
