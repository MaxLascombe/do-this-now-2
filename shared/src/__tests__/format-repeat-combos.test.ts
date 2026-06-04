import { describe, expect, it } from 'vitest'

import { formatRepeat } from '../format'

const NONE = [false, false, false, false, false, false, false] as const

// Branch combinations the main formatRepeat suite doesn't cover: the
// month/year singular labels, an interval > 1 combined with selected
// weekdays, and a fully-selected weekday set.
describe('formatRepeat — combined branches', () => {
  it('labels month/year singular intervals', () => {
    expect(formatRepeat('Custom', 1, 'month', NONE)).toBe('monthly')
    expect(formatRepeat('Custom', 1, 'year', NONE)).toBe('yearly')
  })

  it('combines a multi-week interval with selected weekdays', () => {
    expect(
      formatRepeat('Custom', 2, 'week', [
        false, true, false, true, false, true, false,
      ]),
    ).toBe('2 weeks: mo, we, fr')
  })

  it('lists every weekday when all are selected', () => {
    expect(
      formatRepeat('Custom', 1, 'week', [true, true, true, true, true, true, true]),
    ).toBe('weekly: su, mo, tu, we, th, fr, sa')
  })

  it('ignores weekdays for non-week units', () => {
    expect(
      formatRepeat('Custom', 1, 'day', [
        false, true, false, false, false, false, false,
      ]),
    ).toBe('daily')
  })
})
