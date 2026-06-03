import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { v, validate } from '../validate'

describe('validate', () => {
  const parse = validate(z.object({ n: z.number() }))

  it('returns the parsed value for valid input', () => {
    expect(parse({ n: 1 })).toEqual({ n: 1 })
  })

  it('throws for invalid input (the inputValidator contract)', () => {
    expect(() => parse({ n: 'x' })).toThrow()
  })
})

describe('v atoms', () => {
  it('id accepts a UUID and rejects anything else', () => {
    expect(v.id.safeParse('00000000-0000-0000-0000-000000000000').success).toBe(
      true,
    )
    expect(v.id.safeParse('not-a-uuid').success).toBe(false)
  })

  it('tzOffsetMin accepts real-world offsets and rejects the rest', () => {
    for (const ok of [0, 300, -840, 840]) {
      expect(v.tzOffsetMin.safeParse(ok).success).toBe(true)
    }
    for (const bad of [841, -841, 1.5]) {
      expect(v.tzOffsetMin.safeParse(bad).success).toBe(false)
    }
  })
})
