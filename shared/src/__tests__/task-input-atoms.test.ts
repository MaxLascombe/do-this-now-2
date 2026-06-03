import { describe, expect, it } from 'vitest'

import {
  repeatOptionSchema,
  repeatUnitSchema,
  repeatWeekdaysSchema,
  timeframeTypeSchema,
} from '../task-input'

describe('repeatWeekdaysSchema', () => {
  it('accepts a 7-boolean tuple', () => {
    const none = [false, false, false, false, false, false, false]
    expect(repeatWeekdaysSchema.safeParse(none).success).toBe(true)
    const mwf = [false, true, false, true, false, true, false]
    expect(repeatWeekdaysSchema.safeParse(mwf).success).toBe(true)
  })

  it('rejects the wrong length or non-booleans', () => {
    expect(
      repeatWeekdaysSchema.safeParse(new Array(6).fill(false)).success,
    ).toBe(false)
    expect(
      repeatWeekdaysSchema.safeParse(new Array(8).fill(false)).success,
    ).toBe(false)
    expect(
      repeatWeekdaysSchema.safeParse([false, false, false, false, false, false, 1])
        .success,
    ).toBe(false)
  })
})

describe('repeat enums accept known values and reject others', () => {
  it('repeatOptionSchema', () => {
    expect(repeatOptionSchema.safeParse('Weekly').success).toBe(true)
    expect(repeatOptionSchema.safeParse('Fortnightly').success).toBe(false)
  })

  it('repeatUnitSchema', () => {
    expect(repeatUnitSchema.safeParse('week').success).toBe(true)
    expect(repeatUnitSchema.safeParse('fortnight').success).toBe(false)
  })

  it('timeframeTypeSchema', () => {
    expect(timeframeTypeSchema.safeParse('fluid').success).toBe(true)
    expect(timeframeTypeSchema.safeParse('liquid').success).toBe(false)
  })
})
