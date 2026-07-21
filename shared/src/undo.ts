import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// The global Undo stack (feature plan 2026-07-21): every mutation except
// timer start/pause pushes an inverse here; z / ⌘Z on web and the toast
// Undo button on mobile pop it. Per-device, in-memory, session-scoped —
// a reload clears it by design.

export const MAX_UNDO = 20

export type UndoEntry = {
  label: string
  run: () => Promise<unknown>
}

export type UndoStack = {
  readonly size: number
  push: (entry: UndoEntry) => void
  // Pops and runs the newest entry; resolves with it (for "Undone: …"
  // feedback) or null when the stack is empty. A failing run re-throws
  // after dropping the entry — retrying a broken inverse loops forever.
  undoLast: () => Promise<UndoEntry | null>
}

// Pure stack behind the provider — React-free so it's directly testable.
export function createUndoStack(notify?: (size: number) => void): UndoStack {
  let entries: Array<UndoEntry> = []
  return {
    get size() {
      return entries.length
    },
    push: (entry) => {
      entries = [...entries.slice(-(MAX_UNDO - 1)), entry]
      notify?.(entries.length)
    },
    undoLast: async () => {
      const entry = entries.pop()
      notify?.(entries.length)
      if (!entry) return null
      await entry.run()
      return entry
    },
  }
}

const noopStack = createUndoStack()

const UndoContext = createContext<UndoStack>(noopStack)

// Module-level handle for non-React callers — the timer mutation defaults
// are registered at QueryClient construction, outside the component tree.
// UndoProvider keeps it pointed at the live stack.
export const undoRef: { current: UndoStack } = { current: noopStack }

export function UndoProvider({ children }: { children: ReactNode }) {
  // The size state exists only so consumers re-render when the stack moves.
  const [, setSize] = useState(0)
  const stackRef = useRef<UndoStack | null>(null)
  stackRef.current ??= createUndoStack((n) => setSize(n))

  useEffect(() => {
    undoRef.current = stackRef.current as UndoStack
  }, [])

  return createElement(
    UndoContext.Provider,
    { value: stackRef.current },
    children,
  )
}

// Defaults to a no-op-ish stack so mutation hooks work in tests and any
// tree without a provider.
export function useUndo(): UndoStack {
  return useContext(UndoContext)
}
