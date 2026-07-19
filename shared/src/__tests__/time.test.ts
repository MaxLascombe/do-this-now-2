import { describe, expect, it } from 'vitest'

import { minutesToHours } from '../time'

describe('minutesToHours', () => {
  it('formats whole hours without a minutes suffix', () => {
    expect(minutesToHours(0)).toBe('0h')
    expect(minutesToHours(60)).toBe('1h')
    expect(minutesToHours(120)).toBe('2h')
    expect(minutesToHours(1440)).toBe('24h')
  })

  it('formats sub-hour values with a leading-zero hour', () => {
    expect(minutesToHours(30)).toBe('0h30')
    expect(minutesToHours(5)).toBe('0h05')
    expect(minutesToHours(59)).toBe('0h59')
  })

  it('zero-pads the trailing minutes when present', () => {
    expect(minutesToHours(61)).toBe('1h01')
    expect(minutesToHours(90)).toBe('1h30')
    expect(minutesToHours(125)).toBe('2h05')
  })

  it('rounds fluid EMA decimals instead of printing them', () => {
    expect(minutesToHours(30.42)).toBe('0h30')
    expect(minutesToHours(33.51966)).toBe('0h34')
    expect(minutesToHours(119.7)).toBe('2h')
    expect(minutesToHours(59.9)).toBe('1h')
  })
})
