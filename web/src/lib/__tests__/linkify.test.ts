import { describe, expect, it } from 'vitest'

import { splitOnLinks } from '../linkify'

describe('splitOnLinks', () => {
  it('returns a single plain segment when there are no links', () => {
    expect(splitOnLinks('just some notes')).toEqual([
      { text: 'just some notes', href: null },
    ])
  })

  it('linkifies an http(s) url surrounded by text', () => {
    expect(splitOnLinks('see https://example.com now')).toEqual([
      { text: 'see ', href: null },
      { text: 'https://example.com', href: 'https://example.com' },
      { text: ' now', href: null },
    ])
  })

  it('peels trailing sentence punctuation off the url', () => {
    expect(splitOnLinks('open https://a.io/x.')).toEqual([
      { text: 'open ', href: null },
      { text: 'https://a.io/x', href: 'https://a.io/x' },
      { text: '.', href: null },
    ])
  })

  it('handles multiple links', () => {
    const out = splitOnLinks('http://a.com and https://b.com')
    expect(out.filter((s) => s.href).map((s) => s.href)).toEqual([
      'http://a.com',
      'https://b.com',
    ])
  })

  it('does NOT linkify non-http schemes', () => {
    const out = splitOnLinks('run javascript:alert(1) or mailto:x@y.com')
    expect(out.every((s) => s.href === null)).toBe(true)
  })

  it('is a single empty-free result for empty input', () => {
    expect(splitOnLinks('')).toEqual([])
  })
})
