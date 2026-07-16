// @vitest-environment jsdom
import keycode from 'keycode'
import { describe, expect, it } from 'vitest'

import { matchesKeyAction, ownsActivation, type KeyAction } from '../useKeyAction'

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

describe('ownsActivation (guards Space from stealing button activation)', () => {
  const withRole = (tag: string, role?: string) => {
    const el = document.createElement(tag)
    if (role) el.setAttribute('role', role)
    return el
  }

  it('yields to elements that handle Space/Enter themselves', () => {
    expect(ownsActivation(document.createElement('button'))).toBe(true)
    expect(ownsActivation(document.createElement('a'))).toBe(true)
    expect(ownsActivation(withRole('div', 'button'))).toBe(true)

    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    // jsdom doesn't compute isContentEditable from the attribute; force it.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    expect(ownsActivation(editable)).toBe(true)
  })

  it('does not guard plain elements or an empty focus', () => {
    expect(ownsActivation(document.createElement('div'))).toBe(false)
    expect(ownsActivation(document.createElement('h1'))).toBe(false)
    expect(ownsActivation(withRole('div', 'heading'))).toBe(false)
    expect(ownsActivation(null)).toBe(false)
  })
})
