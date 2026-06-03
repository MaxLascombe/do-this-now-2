import { describe, expect, it } from 'vitest'

import { formatRepeat } from '../format'

const NO_DAYS = [false, false, false, false, false, false, false]
// index 0=su 1=mo 2=tu 3=we 4=th 5=fr 6=sa
const MO_WE = [false, true, false, true, false, false, false]

describe('formatRepeat — preset month/year', () => {
  it('lowercases Monthly and Yearly', () => {
    expect(formatRepeat('Monthly', 1, 'day', NO_DAYS)).toBe('monthly')
    expect(formatRepeat('Yearly', 1, 'day', NO_DAYS)).toBe('yearly')
  })
})

describe('formatRepeat — custom intervals across units', () => {
  it('pluralizes day/month/year intervals', () => {
    expect(formatRepeat('Custom', 3, 'day', NO_DAYS)).toBe('3 days')
    expect(formatRepeat('Custom', 2, 'month', NO_DAYS)).toBe('2 months')
    expect(formatRepeat('Custom', 5, 'year', NO_DAYS)).toBe('5 years')
  })

  it('uses the singular Nly form when the interval is 1', () => {
    expect(formatRepeat('Custom', 1, 'month', NO_DAYS)).toBe('monthly')
    expect(formatRepeat('Custom', 1, 'year', NO_DAYS)).toBe('yearly')
  })
})

describe('formatRepeat — weekday suffix', () => {
  it('combines a plural week interval with the weekday list', () => {
    expect(formatRepeat('Custom', 2, 'week', MO_WE)).toBe('2 weeks: mo, we')
  })

  it('ignores selected weekdays when the unit is not week', () => {
    expect(formatRepeat('Custom', 1, 'day', MO_WE)).toBe('daily')
    expect(formatRepeat('Custom', 2, 'month', MO_WE)).toBe('2 months')
  })
})
