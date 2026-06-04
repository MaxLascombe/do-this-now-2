import keycode from 'keycode'
import { useCallback, useEffect, useRef } from 'react'

export type KeyAction = {
  key: string
  description: string
  action: ((e: KeyboardEvent) => void) | (() => void)
  shift?: boolean
}

// True when a keydown should trigger this action: the named key matches and
// no alt/ctrl/meta is held, with shift required to match only when specified.
export const matchesKeyAction = (
  e: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'which'>,
  kA: KeyAction,
): boolean =>
  !e.altKey &&
  !e.ctrlKey &&
  !e.metaKey &&
  keycode(kA.key) === e.which &&
  (kA.shift === undefined || kA.shift === e.shiftKey)

const useKeyAction = (
  keyActions: Array<KeyAction>,
  event: 'keydown' | 'keyup' = 'keydown',
) => {
  // Read actions from a ref so a fresh array each render doesn't re-bind the listener.
  const actionsRef = useRef(keyActions)
  useEffect(() => {
    actionsRef.current = keyActions
  })

  const callback = useCallback((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    )
      return
    for (const kA of actionsRef.current) {
      if (matchesKeyAction(e, kA)) {
        e.preventDefault()
        kA.action(e)
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener(event, callback)
    return () => document.removeEventListener(event, callback)
  }, [event, callback])
}

export default useKeyAction
