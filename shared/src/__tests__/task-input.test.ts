import { describe, expect, it } from 'vitest'

import { dueTimeSchema, ymdSchema } from '../task-input'

describe('ymdSchema', () => {
  it('accepts real dates in YYYY-M-D form', () => {
    expect(ymdSchema.safeParse('2026-3-5').success).toBe(true)
    expect(ymdSchema.safeParse('2026-12-31').success).toBe(true)
    expect(ymdSchema.safeParse('2024-2-29').success).toBe(true) // leap year
  })

  it('rejects impossible calendar dates', () => {
    expect(ymdSchema.safeParse('2026-2-30').success).toBe(false)
    expect(ymdSchema.safeParse('2025-4-31').success).toBe(false)
    expect(ymdSchema.safeParse('2025-2-29').success).toBe(false) // not a leap year
    expect(ymdSchema.safeParse('2026-6-31').success).toBe(false)
  })

  it('rejects out-of-range and malformed input', () => {
    expect(ymdSchema.safeParse('2026-13-1').success).toBe(false)
    expect(ymdSchema.safeParse('2026-0-1').success).toBe(false)
    expect(ymdSchema.safeParse('2026-1-0').success).toBe(false)
    expect(ymdSchema.safeParse('1969-1-1').success).toBe(false)
    expect(ymdSchema.safeParse('2026-1').success).toBe(false)
    expect(ymdSchema.safeParse('No Due Date').success).toBe(false)
    expect(ymdSchema.safeParse('').success).toBe(false)
  })
})

describe('dueTimeSchema', () => {
  it('accepts valid 24h times and null', () => {
    expect(dueTimeSchema.safeParse('00:00').success).toBe(true)
    expect(dueTimeSchema.safeParse('23:59').success).toBe(true)
    expect(dueTimeSchema.safeParse('09:30').success).toBe(true)
    expect(dueTimeSchema.safeParse(null).success).toBe(true)
  })

  it('rejects out-of-range or malformed times', () => {
    expect(dueTimeSchema.safeParse('24:00').success).toBe(false)
    expect(dueTimeSchema.safeParse('23:60').success).toBe(false)
    expect(dueTimeSchema.safeParse('9:30').success).toBe(false)
    expect(dueTimeSchema.safeParse('0930').success).toBe(false)
  })
})
