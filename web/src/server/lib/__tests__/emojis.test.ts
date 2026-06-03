import { describe, expect, it } from 'vitest'

import { extractEmojis } from '../emojis'

describe('extractEmojis', () => {
  it('returns an empty array when there are no emoji', () => {
    expect(extractEmojis('do the laundry')).toEqual([])
    expect(extractEmojis('')).toEqual([])
  })

  it('extracts a single trailing emoji, dropping surrounding text', () => {
    expect(extractEmojis('laundry 🧺')).toEqual(['🧺'])
  })

  it('splits space-separated emoji into separate elements', () => {
    expect(extractEmojis('🎉 🎂 🥳')).toEqual(['🎉', '🎂', '🥳'])
  })

  it('drops numbering and other non-emoji characters', () => {
    expect(extractEmojis('1. 🏃 2. 💪')).toEqual(['🏃', '💪'])
  })

  it('keeps a skin-tone-modified emoji whole', () => {
    expect(extractEmojis('👍🏽')).toEqual(['👍🏽'])
  })

  it('keeps a ZWJ family sequence whole', () => {
    expect(extractEmojis('👨‍👩‍👧')).toEqual(['👨‍👩‍👧'])
  })

  it('keeps a VS-16 + ZWJ flag sequence whole', () => {
    expect(extractEmojis('🏳️‍🌈')).toEqual(['🏳️‍🌈'])
  })
})
