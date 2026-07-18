import { and, eq } from 'drizzle-orm'

import { livePushTokens, tasks } from '@dtn/shared/schema'
import { db } from '../../db'
import {
  ApnsError,
  apnsConfigured,
  sendLiveActivityPush,
  tokenDigest,
} from './apns'
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

async function sendOrPrune(
  row: { id: string; token: string },
  push: Parameters<typeof sendLiveActivityPush>[1],
): Promise<void> {
  try {
    await sendLiveActivityPush(row.token, push)
  } catch (err) {
    // 410 Unregistered / 400 BadDeviceToken = the token will never work
    // again (activity ended, app reinstalled) — drop the row. Anything else
    // (network, throttle) is transient: log and keep the token.
    if (
      err instanceof ApnsError &&
      (err.status === 410 || err.reason === 'BadDeviceToken')
    ) {
      await dropToken(row.id)
      return
    }
    console.error(`lockscreen push failed (token ${tokenDigest(row.token)})`, err)
  }
}

// Mirror the user's current state onto every registered phone. Fire-and-
// forget from mutation routes (`void syncLockScreen(userId)`) — a push
// failure must never fail the mutation that triggered it.
//
// Per device: an 'update' token means an activity is (or was) live there —
// update it in place (also how a Selected-Task switch lands, per the
// update-in-place decision). A device with only a 'start' token gets a
// push-to-start. When nothing is Selected, end every live activity and
// forget its update token (a fresh one arrives when the next activity
// starts).
// Route-side hook: sync without awaiting or failing the mutation.
export const syncLockScreenSoon = (userId: string): void => {
  void syncLockScreen(userId).catch((err) =>
    console.error('syncLockScreen failed', err),
  )
}

export async function syncLockScreen(userId: string): Promise<void> {
  if (!apnsConfigured()) return
  const [state, tokens] = await Promise.all([
    buildLockScreenState(userId),
    db.select().from(livePushTokens).where(eq(livePushTokens.userId, userId)),
  ])
  const updates = tokens.filter((t) => t.kind === 'update')
  const starts = tokens.filter((t) => t.kind === 'start')

  if (state === null) {
    await Promise.all(
      updates.map(async (row) => {
        await sendOrPrune(row, {
          event: 'end',
          contentState: {},
          dismissalDate: new Date(),
        })
        await dropToken(row.id)
      }),
    )
    return
  }

  const contentState = state as unknown as Record<string, unknown>
  const devicesWithActivity = new Set(updates.map((t) => t.deviceId))
  await Promise.all([
    ...updates.map((row) => sendOrPrune(row, { event: 'update', contentState })),
    ...starts
      .filter((row) => !devicesWithActivity.has(row.deviceId))
      .map((row) =>
        sendOrPrune(row, {
          event: 'start',
          contentState,
          attributesType: ATTRIBUTES_TYPE,
          attributes: {},
        }),
      ),
  ])
}
