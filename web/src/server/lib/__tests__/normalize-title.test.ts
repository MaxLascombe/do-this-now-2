import { describe, expect, it } from 'vitest'

import { normalizeTitle } from '../emojis'

describe('normalizeTitle', () => {
  it('lowercases and trims', () => {
    expect(normalizeTitle('  Buy Milk ')).toBe('buy milk')
  })

  it('collapses internal whitespace', () => {
    expect(normalizeTitle('buy   milk')).toBe('buy milk')
    expect(normalizeTitle('buy\tmilk\nnow')).toBe('buy milk now')
  })

  it('maps surface variants of the same title to one key', () => {
    const variants = ['Buy milk', 'buy  milk', 'BUY MILK', ' buy milk ']
    const keys = new Set(variants.map(normalizeTitle))
    expect(keys.size).toBe(1)
  })

  it('is empty for whitespace-only input', () => {
    expect(normalizeTitle('   ')).toBe('')
  })
})
