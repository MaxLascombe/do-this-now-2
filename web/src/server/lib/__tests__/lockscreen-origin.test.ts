import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  livePushTokens,
  lockScreenDevices,
  tasks,
  userState,
} from '@dtn/shared/schema'

// Mocked in THIS file only (actions.test.ts must keep the real, unconfigured
// module so its mutations' waitUntil syncs stay no-ops).
vi.mock('../apns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../apns')>()
  return {
    ...actual,
    apnsConfigured: () => true,
    sendLiveActivityPush: vi.fn(async () => {}),
  }
})

import { db } from '../../../db'
import { sendLiveActivityPush } from '../apns'
import { syncLockScreen } from '../lockscreen'

// Guards the duplicate-start race closed by the local-first mirror
// (ADR-0006): the device that originated a request already started its
// activity locally, so the sync must not push-to-start it — while other
// devices still get theirs.

const TEST_USER = 'user_vitest_lockscreen_origin'

async function cleanup() {
  await db.delete(livePushTokens).where(eq(livePushTokens.userId, TEST_USER))
  await db
    .delete(lockScreenDevices)
    .where(eq(lockScreenDevices.userId, TEST_USER))
  await db.delete(userState).where(eq(userState.userId, TEST_USER))
  await db.delete(tasks).where(eq(tasks.userId, TEST_USER))
}

async function seedSelectedTask() {
  const [task] = await db
    .insert(tasks)
    .values({
      userId: TEST_USER,
      title: 'Origin skip test',
      emoji: '📱',
      due: '2026-5-12',
      repeat: 'No Repeat',
      repeatInterval: 1,
      repeatUnit: 'day',
      timeFrame: 30,
      subtasks: [],
    })
    .returning()
  await db
    .insert(userState)
    .values({ userId: TEST_USER, selectedTaskId: task.id })
}

async function seedDeviceWithStartToken(tokenHash: string, token: string) {
  const [device] = await db
    .insert(lockScreenDevices)
    .values({ userId: TEST_USER, tokenHash, label: null })
    .returning()
  await db
    .insert(livePushTokens)
    .values({ userId: TEST_USER, deviceId: device.id, kind: 'start', token })
  return device.id
}

describe.skipIf(!process.env.DATABASE_URL)(
  'syncLockScreen origin skip (integration)',
  () => {
    beforeEach(async () => {
      await cleanup()
      vi.mocked(sendLiveActivityPush).mockClear()
    })
    afterAll(cleanup)

    it('skips push-to-start for the origin device but not for others', async () => {
      await seedSelectedTask()
      const originId = await seedDeviceWithStartToken('hash-origin', 'aa11')
      const otherId = await seedDeviceWithStartToken('hash-other', 'bb22')

      await syncLockScreen(TEST_USER, { deviceId: originId })

      const sent = vi.mocked(sendLiveActivityPush).mock.calls
      expect(sent).toHaveLength(1)
      expect(sent[0][0]).toBe('bb22')
      expect(sent[0][1].event).toBe('start')

      const rows = await db
        .select()
        .from(livePushTokens)
        .where(eq(livePushTokens.userId, TEST_USER))
      const byDevice = new Map(rows.map((r) => [r.deviceId, r]))
      // claimStart stamps only the device actually pushed to — the origin
      // stays unclaimed so a later web-originated sync can still start it.
      expect(byDevice.get(originId)?.startSentAt).toBeNull()
      expect(byDevice.get(otherId)?.startSentAt).not.toBeNull()
    })

    it('without an origin, both devices get a push-to-start', async () => {
      await seedSelectedTask()
      await seedDeviceWithStartToken('hash-a', 'aa11')
      await seedDeviceWithStartToken('hash-b', 'bb22')

      await syncLockScreen(TEST_USER, null)

      const tokens = vi
        .mocked(sendLiveActivityPush)
        .mock.calls.map(([t]) => t)
        .sort()
      expect(tokens).toEqual(['aa11', 'bb22'])
    })
  },
)
