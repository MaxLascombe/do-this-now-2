import { describe, expect, it } from 'vitest'

import { computePoints } from '../scoring'

// The main suite checks each multiplier at a band boundary; these cover
// values that fall *inside* a band and the lives-parameter extremes, where
// the 1x / 2x / 3x split shifts.
describe('computePoints band combinations', () => {
  it('scores a partial fill of the lives band (1x then 2x)', () => {
    // 80 min below (todo - lives) at 1x, 10 min inside the lives band at 2x.
    expect(computePoints(90, 100, 20)).toBe(100)
  })

  it('scores past target with a partially-filled lives band', () => {
    // 80 @1x + 20 @2x + 10 @3x.
    expect(computePoints(110, 100, 20)).toBe(150)
  })

  it('treats the whole target as the 2x band when lives equals todo', () => {
    expect(computePoints(50, 100, 100)).toBe(100)
  })

  it('scores everything at 1x below target when there are no lives', () => {
    expect(computePoints(50, 100, 0)).toBe(50)
  })
})
