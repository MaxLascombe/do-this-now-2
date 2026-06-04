import { formatDueLabel } from '@dtn/shared/format'
import { newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

type Item = {
  key: string
  glyph: string
  label: string
  hint?: string
  run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const tasksQuery = useAllTasks({ enabled: false })
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => {
          if (!v)
            restoreRef.current = document.activeElement as HTMLElement | null
          return !v
        })
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    void tasksQuery.refetch()
    setQuery('')
    setSelected(0)
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(t)
      document.body.style.overflow = prevOverflow
      restoreRef.current?.focus?.()
    }
  }, [open])

  const close = () => setOpen(false)

  const pages: Item[] = [
    { key: 'p:now', glyph: '◉', label: 'Now', run: () => navigate({ to: '/' }) },
    {
      key: 'p:tasks',
      glyph: '☰',
      label: 'Tasks',
      run: () => navigate({ to: '/tasks' }),
    },
    {
      key: 'p:new',
      glyph: '＋',
      label: 'New task',
      run: () => navigate({ to: '/new-task' }),
    },
    {
      key: 'p:history',
      glyph: '◷',
      label: 'History',
      run: () => navigate({ to: '/history' }),
    },
    {
      key: 'p:calendar',
      glyph: '▦',
      label: 'Calendar',
      run: () => navigate({ to: '/calendar' }),
    },
    {
      key: 'p:stats',
      glyph: '▤',
      label: 'Stats',
      run: () => navigate({ to: '/stats' }),
    },
  ]

  const q = query.trim().toLowerCase()
  const taskItems: Item[] = (tasksQuery.data ?? [])
    .filter((t) => !q || t.title.toLowerCase().includes(q))
    .sort((a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime())
    .slice(0, 8)
    .map((t) => ({
      key: 't:' + t.id,
      glyph: t.emoji,
      label: t.title,
      hint: formatDueLabel(t.due, t.dueTime) || 'Task',
      run: () => navigate({ to: '/tasks/$id', params: { id: t.id } }),
    }))

  const createItems: Item[] = query.trim()
    ? [
        {
          key: 'create',
          glyph: '＋',
          label: `Create "${query.trim()}"`,
          hint: 'New',
          run: () =>
            navigate({ to: '/new-task', search: { title: query.trim() } }),
        },
      ]
    : []

  const results = [
    ...pages.filter((p) => !q || p.label.toLowerCase().includes(q)),
    ...taskItems,
    ...createItems,
  ]
  const active = Math.min(selected, Math.max(0, results.length - 1))

  const activate = (item: Item | undefined) => {
    if (!item) return
    close()
    item.run()
  }

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => (results.length ? (i + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      activate(results[active])
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 font-mono shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSelected(0)
          }}
          onKeyDown={onInputKey}
          placeholder="Jump to a page or task…"
          aria-label="Search pages and tasks"
          className="w-full border-b border-zinc-800 bg-transparent px-5 py-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        <ul className="max-h-[50vh] overflow-y-auto py-2">
          {results.length === 0 && (
            <li className="px-5 py-6 text-center text-sm text-zinc-600">
              No matches
            </li>
          )}
          {results.map((item, i) => {
            const isActive = i === active
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => activate(item)}
                  aria-current={isActive ? 'true' : undefined}
                  className={
                    'flex w-full items-center gap-3 px-5 py-2.5 text-left text-sm transition-colors ' +
                    (isActive ? 'bg-zinc-900 text-zinc-50' : 'text-zinc-400')
                  }
                >
                  <span className="w-5 text-center text-base">{item.glyph}</span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && (
                    <span className="text-[10px] tracking-widest text-zinc-600 uppercase">
                      {item.hint}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-3 border-t border-zinc-800 px-5 py-2 text-[10px] text-zinc-600">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
