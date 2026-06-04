import { describe, expect, it } from 'vitest'

import { cells } from '../progress-cells'

describe('progress cells', () => {
  it('fills the first `filledCount` cells', () => {
    const out = cells(5, 2, 0)
    expect(out.map((c) => c.filled)).toEqual([true, true, false, false, false])
  })

  it('marks the should-be-here tick at tickAt - 1', () => {
    const out = cells(5, 0, 3)
    expect(out.findIndex((c) => c.isTick)).toBe(2)
  })

  it('shows the tick even when that cell is filled (on schedule / ahead)', () => {
    // done past the target: tick cell is filled, but the marker still shows
    const out = cells(5, 4, 2)
    const tick = out[1]
    expect(tick.isTick).toBe(true)
    expect(tick.filled).toBe(true)
  })

  it('renders no tick when tickAt is 0 (before the workday)', () => {
    expect(cells(5, 0, 0).some((c) => c.isTick)).toBe(false)
  })
})
