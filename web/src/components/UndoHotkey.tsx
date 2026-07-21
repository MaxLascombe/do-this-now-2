import { useUndo } from '@dtn/shared/undo'
import { useEffect } from 'react'

import { useToast } from './ToastProvider'

// The global undo key: z (or ⌘Z / Ctrl+Z) pops the newest entry off the
// undo stack, anywhere in the app, unless a text field has focus.
export function UndoHotkey() {
  const undo = useUndo()
  const toast = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'z' || e.shiftKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.tagName === 'SELECT' ||
          t.isContentEditable)
      )
        return
      e.preventDefault()
      void undo
        .undoLast()
        .then((entry) => {
          if (entry) toast({ message: `Undone: ${entry.label}` })
        })
        .catch(() => toast({ message: 'Undo failed' }))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [undo, toast])

  return null
}
