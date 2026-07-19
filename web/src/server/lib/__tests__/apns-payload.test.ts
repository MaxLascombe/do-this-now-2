import { describe, expect, it } from 'vitest'

import { buildLiveActivityPayload } from '../apns'

const state = { taskId: 't1', title: 'Read', running: true }
const at = new Date('2026-07-18T12:00:00Z')

describe('buildLiveActivityPayload', () => {
  it('builds an update payload with epoch timestamp and content-state', () => {
    const { aps } = buildLiveActivityPayload({
      event: 'update',
      contentState: state,
      timestamp: at,
    })
    expect(aps.event).toBe('update')
    expect(aps.timestamp).toBe(1784376000)
    expect(aps['content-state']).toEqual(state)
    expect(aps).not.toHaveProperty('attributes-type')
    expect(aps).not.toHaveProperty('alert')
  })

  it('start carries attributes-type, attributes, and the required alert', () => {
    const { aps } = buildLiveActivityPayload({
      event: 'start',
      contentState: state,
      attributesType: 'LockScreenTimerAttributes',
      timestamp: at,
    })
    expect(aps['attributes-type']).toBe('LockScreenTimerAttributes')
    expect(aps.attributes).toEqual({})
    expect(aps.alert).toMatchObject({ sound: 'silence.caf' })
  })

  it('end carries a dismissal-date in epoch seconds', () => {
    const { aps } = buildLiveActivityPayload({
      event: 'end',
      contentState: {},
      dismissalDate: at,
      timestamp: at,
    })
    expect(aps.event).toBe('end')
    expect(aps['dismissal-date']).toBe(1784376000)
  })
})
