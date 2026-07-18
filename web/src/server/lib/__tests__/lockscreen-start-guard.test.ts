import { describe, expect, it } from 'vitest'

import { START_ACK_COOLDOWN_MS, shouldSendStart } from '../lockscreen'

const now = new Date('2026-07-18T12:00:00Z')
const device = 'dev-1'

describe('shouldSendStart', () => {
  it('sends when the device has no activity and no pending start', () => {
    expect(
      shouldSendStart({ deviceId: device, startSentAt: null }, new Set(), now),
    ).toBe(true)
  })

  it('never sends to a device with a live activity (update token)', () => {
    expect(
      shouldSendStart(
        { deviceId: device, startSentAt: null },
        new Set([device]),
        now,
      ),
    ).toBe(false)
  })

  it('suppresses a repeat start while a recent one is unacknowledged', () => {
    const recent = new Date(now.getTime() - 60_000)
    expect(
      shouldSendStart(
        { deviceId: device, startSentAt: recent },
        new Set(),
        now,
      ),
    ).toBe(false)
  })

  it('retries once the cooldown has elapsed', () => {
    const stale = new Date(now.getTime() - START_ACK_COOLDOWN_MS - 1)
    expect(
      shouldSendStart(
        { deviceId: device, startSentAt: stale },
        new Set(),
        now,
      ),
    ).toBe(true)
  })
})
