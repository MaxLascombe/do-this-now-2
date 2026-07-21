import { describe, expect, it } from 'vitest'

import { timerAtPlan } from '../timer-utils'
import { makeTask } from './_factories'

const now = new Date('2026-05-01T12:00:00Z')

describe('timerAtPlan', () => {
  it('is false before the planned time is reached', () => {
    const task = makeTask({ timerAccumulatedSeconds: 29 * 60 })
    expect(timerAtPlan(task, 30, now)).toBe(false)
  })

  it('flips true the second elapsed reaches the plan', () => {
    const task = makeTask({ timerAccumulatedSeconds: 30 * 60 })
    expect(timerAtPlan(task, 30, now)).toBe(true)
  })

  it('counts live running time toward the plan', () => {
    const task = makeTask({
      timerAccumulatedSeconds: 20 * 60,
      timerStartedAt: new Date(now.getTime() - 10 * 60 * 1000),
    })
    expect(timerAtPlan(task, 30, now)).toBe(true)
  })

  it('never fires with no planned time (children, zero timeframes)', () => {
    const task = makeTask({ timerAccumulatedSeconds: 999 * 60 })
    expect(timerAtPlan(task, 0, now)).toBe(false)
  })
})
