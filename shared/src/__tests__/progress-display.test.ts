import { describe, expect, it } from 'vitest'

import {
  computeWinEta,
  formatWinEta,
  progressCells,
  splitBarUnits,
} from '../progress-display'

const at = (h: number, m: number) => new Date(2026, 4, 1, h, m)
const WORKDAY = { workdayStartMin: 8 * 60 + 30, workdayEndMin: 24 * 60 }

describe('splitBarUnits', () => {
  it('reads empty on a no-tasks day (todo 0)', () => {
    expect(splitBarUnits({ done: 30, lives: 10, todo: 0, count: 24 })).toEqual({
      doneUnits: 0,
      livesUnits: 0,
    })
  })

  it('splits done and lives fill proportionally', () => {
    // done 6/24h of bar, lives another 6/24
    const s = splitBarUnits({ done: 60, lives: 60, todo: 240, count: 24 })
    expect(s).toEqual({ doneUnits: 6, livesUnits: 6 })
  })

  it('never reads full before the day is won, despite rounding', () => {
    // 99% of the way there rounds to the full cell count — clamp to count-1.
    const s = splitBarUnits({ done: 237, lives: 0, todo: 240, count: 24 })
    expect(s.doneUnits + s.livesUnits).toBe(23)
  })

  it('reads exactly full the moment done + lives reaches the target', () => {
    const s = splitBarUnits({ done: 180, lives: 60, todo: 240, count: 24 })
    expect(s.doneUnits + s.livesUnits).toBe(24)
    expect(s.livesUnits).toBeGreaterThan(0) // lives visibly carried the win
  })

  it('shows all-done fill with no lives band when done alone wins', () => {
    const s = splitBarUnits({ done: 300, lives: 120, todo: 240, count: 24 })
    expect(s).toEqual({ doneUnits: 24, livesUnits: 0 })
  })
})

describe('progressCells', () => {
  it('lays out done, lives, then empty cells with the tick marker', () => {
    const cells = progressCells({
      count: 8,
      done: 30,
      lives: 30,
      todo: 120,
      shouldBeDone: 60,
    })
    expect(cells.map((c) => c.fill)).toEqual([
      'done',
      'done',
      'lives',
      'lives',
      'empty',
      'empty',
      'empty',
      'empty',
    ])
    // tick at round(60/120*8) = cell 4 (index 3) — inside the lives band,
    // proving lives fill can sit past the tick while pace lags.
    expect(cells.findIndex((c) => c.isTick)).toBe(3)
  })

  it('renders no tick before the workday (shouldBeDone 0)', () => {
    const cells = progressCells({
      count: 8,
      done: 0,
      lives: 0,
      todo: 120,
      shouldBeDone: 0,
    })
    expect(cells.some((c) => c.isTick)).toBe(false)
  })
})

describe('computeWinEta', () => {
  it('reports won once done + lives covers the target', () => {
    expect(
      computeWinEta({ now: at(10, 0), done: 100, lives: 40, todo: 120, ...WORKDAY }),
    ).toEqual({ kind: 'won' })
  })

  it('projects from the completion-credited pace so far', () => {
    // 60 done in the 90 min since 8:30 → pace 2/3 min per min;
    // 60 remaining → 90 more minutes → 11:30.
    const eta = computeWinEta({
      now: at(10, 0),
      done: 60,
      lives: 0,
      todo: 120,
      ...WORKDAY,
    })
    expect(eta).toEqual({ kind: 'eta', minutesOfDay: 11 * 60 + 30 })
  })

  it('falls back to the tick pace before any completion', () => {
    // Nothing done at 8:30: full 930-min window for the full target → 24:00.
    const eta = computeWinEta({
      now: at(8, 30),
      done: 0,
      lives: 0,
      todo: 930,
      ...WORKDAY,
    })
    expect(eta).toEqual({ kind: 'eta', minutesOfDay: 24 * 60 })
  })

  it('formats past-midnight projections as >24:00', () => {
    const eta = computeWinEta({
      now: at(23, 0),
      done: 10,
      lives: 0,
      todo: 600,
      ...WORKDAY,
    })
    expect(formatWinEta(eta)).toBe('>24:00')
    expect(formatWinEta({ kind: 'won' })).toBe('won')
    expect(formatWinEta({ kind: 'eta', minutesOfDay: 11 * 60 + 5 })).toBe(
      '11:05',
    )
  })
})
