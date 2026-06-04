import { useEffect, useRef, useState } from 'react'

const GROUPS: Array<{
  title: string
  items: Array<{ keys: string[]; label: string }>
}> = [
  {
    title: 'Navigate',
    items: [
      { keys: ['N'], label: 'Now' },
      { keys: ['T'], label: 'Tasks' },
      { keys: ['+'], label: 'New task' },
      { keys: ['H'], label: 'History' },
      { keys: ['A'], label: 'Stats' },
    ],
  },
  {
    title: 'On the Now screen',
    items: [
      { keys: ['D'], label: 'Mark done' },
      { keys: ['S'], label: 'Snooze' },
      { keys: ['E'], label: 'Edit' },
      { keys: ['1', '–', '3'], label: 'Pick a task' },
      { keys: ['↑', '↓'], label: 'Move selection' },
      { keys: ['⌫'], label: 'Delete' },
    ],
  },
  {
    title: 'Anywhere',
    items: [
      { keys: ['⌘', 'K'], label: 'Command palette' },
      { keys: ['?'], label: 'This menu' },
    ],
  },
]

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const restoreRef = useRef<HTMLElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      if (
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement
      )
        return
      if (e.key === '?') {
        e.preventDefault()
        restoreRef.current = document.activeElement as HTMLElement | null
        setOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => dialogRef.current?.focus(), 0)
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 font-mono shadow-2xl focus:outline-none"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          // No interactive children — keep Tab from escaping to the page.
          if (e.key === 'Tab') e.preventDefault()
        }}
      >
        <div className="border-b border-zinc-800 px-5 py-4 text-sm font-semibold text-zinc-100">
          Keyboard shortcuts
        </div>
        <div className="flex flex-col gap-5 px-5 py-5">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="mb-2 text-[10px] tracking-[0.2em] text-zinc-500 uppercase">
                {g.title}
              </div>
              <ul className="flex flex-col gap-2">
                {g.items.map((it) => (
                  <li
                    key={it.label}
                    className="flex items-center justify-between text-sm text-zinc-300"
                  >
                    <span>{it.label}</span>
                    <span className="flex items-center gap-1">
                      {it.keys.map((k) => (
                        <kbd
                          key={k}
                          className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-800 px-5 py-2 text-[10px] text-zinc-600">
          esc close
        </div>
      </div>
    </div>
  )
}
