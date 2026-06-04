import { describe, expect, it } from 'vitest'

import { shouldCompleteOnPause } from '../timer-utils'
import { makeTask } from './_factories'

const NOW = new Date('2026-05-15T12:00:00Z')

// 30-minute fixed task = 1800s target.
const fixed30 = (over: Parameters<typeof makeTask>[0] = {}) =>
  makeTask({ timeframeType: 'fixed', timeFrame: 30, ...over })

describe('shouldCompleteOnPause', () => {
  it('is true for a fixed task whose paused timer reached the target', () => {
    expect(
      shouldCompleteOnPause(
        fixed30({ timerStartedAt: null, timerAccumulatedSeconds: 1800 }),
        NOW,
      ),
    ).toBe(true)
  })

  it('is true when over the target', () => {
    expect(
      shouldCompleteOnPause(
        fixed30({ timerStartedAt: null, timerAccumulatedSeconds: 2400 }),
        NOW,
      ),
    ).toBe(true)
  })

  it('is false when the timer is below the target', () => {
    expect(
      shouldCompleteOnPause(
        fixed30({ timerStartedAt: null, timerAccumulatedSeconds: 1799 }),
        NOW,
      ),
    ).toBe(false)
  })

  it('is false for a fluid task even at/over target', () => {
    expect(
      shouldCompleteOnPause(
        makeTask({
          timeframeType: 'fluid',
          timeFrame: 30,
          timerStartedAt: null,
          timerAccumulatedSeconds: 3600,
        }),
        NOW,
      ),
    ).toBe(false)
  })

  it('is false when there is no target (timeFrame 0)', () => {
    expect(
      shouldCompleteOnPause(
        fixed30({ timeFrame: 0, timerAccumulatedSeconds: 1800 }),
        NOW,
      ),
    ).toBe(false)
  })
})
