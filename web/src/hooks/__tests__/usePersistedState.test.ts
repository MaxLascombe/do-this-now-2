// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { usePersistedState } from '../usePersistedState'

afterEach(() => localStorage.clear())

describe('usePersistedState', () => {
  it('falls back to the initial value when nothing is stored', () => {
    const { result } = renderHook(() => usePersistedState('k', 'CHRON'))
    expect(result.current[0]).toBe('CHRON')
  })

  it('reads a stored value on mount', () => {
    localStorage.setItem('k', JSON.stringify('TOP'))
    const { result } = renderHook(() => usePersistedState('k', 'CHRON'))
    expect(result.current[0]).toBe('TOP')
  })

  // The bug that motivated this: the initial value must not clobber a
  // stored one before the read effect applies it.
  it('does not overwrite the stored value with the initial on mount', () => {
    localStorage.setItem('k', JSON.stringify('TOP'))
    renderHook(() => usePersistedState('k', 'CHRON'))
    expect(localStorage.getItem('k')).toBe(JSON.stringify('TOP'))
  })

  it('leaves storage untouched until a real change when nothing was stored', () => {
    renderHook(() => usePersistedState('k', 'CHRON'))
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('persists a changed value', () => {
    const { result } = renderHook(() =>
      usePersistedState<'CHRON' | 'TOP'>('k', 'CHRON'),
    )
    act(() => result.current[1]('TOP'))
    expect(localStorage.getItem('k')).toBe(JSON.stringify('TOP'))
  })
})
