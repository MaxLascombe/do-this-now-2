import keycode from 'keycode'
import { describe, expect, it } from 'vitest'

import { matchesKeyAction, type KeyAction } from '../useKeyAction'

const action: KeyAction = { key: 'j', description: 'next', action: () => {} }

const ev = (
  over: Partial<
    Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'which'>
  > = {},
) => ({
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  which: keycode('j'),
  ...over,
})

describe('matchesKeyAction', () => {
  it('matches the named key with no modifiers held', () => {
    expect(matchesKeyAction(ev(), action)).toBe(true)
  })

  it('rejects a different key', () => {
    expect(matchesKeyAction(ev({ which: keycode('k') }), action)).toBe(false)
  })

  it('rejects when alt, ctrl, or meta is held', () => {
    expect(matchesKeyAction(ev({ altKey: true }), action)).toBe(false)
    expect(matchesKeyAction(ev({ ctrlKey: true }), action)).toBe(false)
    expect(matchesKeyAction(ev({ metaKey: true }), action)).toBe(false)
  })

  it('ignores shift state when the action leaves shift unspecified', () => {
    expect(matchesKeyAction(ev({ shiftKey: true }), action)).toBe(true)
    expect(matchesKeyAction(ev({ shiftKey: false }), action)).toBe(true)
  })

  it('requires shift to match when the action specifies it', () => {
    const shifted: KeyAction = { ...action, shift: true }
    expect(matchesKeyAction(ev({ shiftKey: true }), shifted)).toBe(true)
    expect(matchesKeyAction(ev({ shiftKey: false }), shifted)).toBe(false)

    const unshifted: KeyAction = { ...action, shift: false }
    expect(matchesKeyAction(ev({ shiftKey: false }), unshifted)).toBe(true)
    expect(matchesKeyAction(ev({ shiftKey: true }), unshifted)).toBe(false)
  })
})
