import { describe, expect, it } from 'vitest'

import {
  completionConfirmKind,
  confirmMessage,
  currentTimerSeconds,
  isCompletionGated,
} from '../timer-utils'
import { makeTask } from './_factories'

const NOW = new Date('2026-05-15T12:00:00Z')

describe('currentTimerSeconds', () => {
  it('returns accumulated when paused', () => {
    const t = makeTask({ timerAccumulatedSeconds: 90, timerStartedAt: null })
    expect(currentTimerSeconds(t, NOW)).toBe(90)
  })

  it('adds elapsed seconds when running', () => {
    const started = new Date(NOW.getTime() - 30_000)
    const t = makeTask({ timerAccumulatedSeconds: 10, timerStartedAt: started })
    expect(currentTimerSeconds(t, NOW)).toBe(40)
  })

  it('coerces ISO-string timerStartedAt (cache-rehydrate path)', () => {
    // After a localStorage rehydrate the Date becomes an ISO string; the
    // helper must handle that without crashing on .getTime().
    const started = new Date(NOW.getTime() - 60_000).toISOString()
    const t = makeTask({
      timerAccumulatedSeconds: 0,
      timerStartedAt: started as unknown as Date,
    })
    expect(currentTimerSeconds(t, NOW)).toBe(60)
  })
})

describe('isCompletionGated', () => {
  it('gates a repeating fixed task whose timer is under target', () => {
    const t = makeTask({
      timeframeType: 'fixed',
      repeat: 'Daily',
      timeFrame: 30,
      timerAccumulatedSeconds: 600, // 10 min
    })
    expect(isCompletionGated(t, NOW)).toBe(true)
  })

  it('opens once the timer reaches target', () => {
    const t = makeTask({
      timeframeType: 'fixed',
      repeat: 'Daily',
      timeFrame: 30,
      timerAccumulatedSeconds: 1800, // 30 min
    })
    expect(isCompletionGated(t, NOW)).toBe(false)
  })

  it('never gates fluid tasks', () => {
    const t = makeTask({
      timeframeType: 'fluid',
      repeat: 'Daily',
      timeFrame: 30,
      timerAccumulatedSeconds: 0,
    })
    expect(isCompletionGated(t, NOW)).toBe(false)
  })

  it('never gates one-shot fixed (always-Done by design)', () => {
    const t = makeTask({
      timeframeType: 'fixed',
      repeat: 'No Repeat',
      timeFrame: 60,
      timerAccumulatedSeconds: 0,
    })
    expect(isCompletionGated(t, NOW)).toBe(false)
  })

  it('never gates children of a timekeeper (keeper owns the timer)', () => {
    const t = makeTask({
      timeframeType: 'fixed',
      repeat: 'Daily',
      timeFrame: 0,
      timekeeperId: 'keeper-id',
    })
    expect(isCompletionGated(t, NOW)).toBe(false)
  })
})

describe('completionConfirmKind', () => {
  const base = makeTask({
    timeframeType: 'fluid',
    timeFrame: 30,
  })

  it('returns null when actual is within 0.5×–1.5× planned', () => {
    expect(
      completionConfirmKind(
        { ...base, timerAccumulatedSeconds: 30 * 60 },
        NOW,
      ),
    ).toBeNull()
    // Exact lower boundary (0.5×) is "within band".
    expect(
      completionConfirmKind(
        { ...base, timerAccumulatedSeconds: 15 * 60 },
        NOW,
      ),
    ).toBeNull()
    // Exact upper boundary (1.5×) is "within band" — only strictly greater
    // counts as 'over'.
    expect(
      completionConfirmKind(
        { ...base, timerAccumulatedSeconds: 45 * 60 },
        NOW,
      ),
    ).toBeNull()
  })

  it('returns "over" when actual > 1.5× planned', () => {
    expect(
      completionConfirmKind(
        { ...base, timerAccumulatedSeconds: 46 * 60 },
        NOW,
      ),
    ).toBe('over')
  })

  it('returns "under" when actual < 0.5× planned', () => {
    expect(
      completionConfirmKind(
        { ...base, timerAccumulatedSeconds: 14 * 60 },
        NOW,
      ),
    ).toBe('under')
  })

  it('fires "under" at zero seconds — front-load workflow', () => {
    // Completing an overdue fluid instance with 0 min should still prompt
    // so the user can choose to count the zero (pulling the EMA down) or
    // skip it. Earlier versions short-circuited at actual <= 0; the fix
    // restored the prompt path.
    expect(completionConfirmKind({ ...base, timerAccumulatedSeconds: 0 }, NOW)).toBe(
      'under',
    )
  })

  it('returns null for fixed tasks regardless of timer', () => {
    expect(
      completionConfirmKind(
        makeTask({
          timeframeType: 'fixed',
          timeFrame: 30,
          timerAccumulatedSeconds: 0,
        }),
        NOW,
      ),
    ).toBeNull()
  })

  it('returns null when planned = 0 (no estimate to compare)', () => {
    expect(
      completionConfirmKind(
        { ...base, timeFrame: 0, timerAccumulatedSeconds: 0 },
        NOW,
      ),
    ).toBeNull()
  })
})

describe('confirmMessage', () => {
  it('renders the "over" copy with rounded minutes', () => {
    const t = makeTask({
      timeframeType: 'fluid',
      timeFrame: 30,
      timerAccumulatedSeconds: 60 * 60,
    })
    const msg = confirmMessage(t, NOW, 'over')
    expect(msg).toContain('60 min')
    expect(msg).toContain('30 min')
    expect(msg).toContain('over 1.5×')
  })

  it('renders the "under" copy', () => {
    const t = makeTask({
      timeframeType: 'fluid',
      timeFrame: 30,
      timerAccumulatedSeconds: 0,
    })
    const msg = confirmMessage(t, NOW, 'under')
    expect(msg).toContain('0 min')
    expect(msg).toContain('under 50%')
  })
})
