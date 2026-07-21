import { describe, expect, it } from 'vitest'

import { runawayThresholdSeconds, timerRunaway } from '../timer-utils'
import { makeTask } from './_factories'

const noon = new Date('2026-05-01T12:00:00')

describe('runaway-timer guard', () => {
  it('thresholds at 3× the plan, or 4h with no plan', () => {
    expect(runawayThresholdSeconds(30)).toBe(90 * 60)
    expect(runawayThresholdSeconds(0)).toBe(240 * 60)
  })

  it('flags once elapsed passes 3× plan', () => {
    const under = makeTask({ timerAccumulatedSeconds: 89 * 60 })
    const over = makeTask({ timerAccumulatedSeconds: 90 * 60 })
    expect(timerRunaway(under, 30, noon)).toBe(false)
    expect(timerRunaway(over, 30, noon)).toBe(true)
  })

  it('flags a timer that has been running since before midnight', () => {
    const overnight = makeTask({
      timerAccumulatedSeconds: 60,
      timerStartedAt: new Date('2026-04-30T23:50:00'),
    })
    expect(timerRunaway(overnight, 30, noon)).toBe(true)
  })

  it('does not flag a same-day running timer under threshold', () => {
    const fresh = makeTask({
      timerAccumulatedSeconds: 0,
      timerStartedAt: new Date('2026-05-01T11:00:00'),
    })
    expect(timerRunaway(fresh, 30, noon)).toBe(false)
  })
})
