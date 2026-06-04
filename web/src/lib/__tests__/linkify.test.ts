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

  it('peels a wrapping quote or angle bracket off the url', () => {
    expect(splitOnLinks('doc "https://a.io".')).toEqual([
      { text: 'doc "', href: null },
      { text: 'https://a.io', href: 'https://a.io' },
      { text: '".', href: null },
    ])
    const angle = splitOnLinks('<https://a.io>')
    expect(angle.find((s) => s.href)?.href).toBe('https://a.io')
  })

  it('keeps parens in a url path (wikipedia-style)', () => {
    const out = splitOnLinks('https://en.wikipedia.org/wiki/Foo_(bar)')
    expect(out).toEqual([
      {
        text: 'https://en.wikipedia.org/wiki/Foo_(bar)',
        href: 'https://en.wikipedia.org/wiki/Foo_(bar)',
      },
    ])
  })

  it('handles a url as the entire note', () => {
    expect(splitOnLinks('https://x.com/path')).toEqual([
      { text: 'https://x.com/path', href: 'https://x.com/path' },
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
