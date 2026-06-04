import { useClerk } from '@clerk/tanstack-react-start'
import { startOfToday } from '@dtn/shared/day-index'
import { formatDueLabel } from '@dtn/shared/format'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
import {
  useAllTasks,
  useCreateTask,
  useSnoozeTask,
} from '@dtn/shared/queries'
import { isSnoozed } from '@dtn/shared/task-sorting'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { useConfirm } from './ConfirmProvider'

type Item = {
  key: string
  glyph: string
  label: string
  hint?: string
  run: () => void
  // Keep the palette open after running (for rapid repeated capture).
  keepOpen?: boolean
}

export function CommandPalette() {
  const navigate = useNavigate()
  const { signOut } = useClerk()
  const createTask = useCreateTask()
  const snoozeTask = useSnoozeTask()
  const confirm = useConfirm()
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
      key: 'p:tags',
      glyph: '#',
      label: 'Tags',
      run: () => navigate({ to: '/tags' }),
    },
    {
      key: 'p:stats',
      glyph: '▤',
      label: 'Stats',
      run: () => navigate({ to: '/stats' }),
    },
  ]

  const q = query.trim().toLowerCase()
  const matchTag = (t: { tags: string[] }) =>
    t.tags.find((tag) => tag.toLowerCase().includes(q))
  const taskItems: Item[] = (tasksQuery.data ?? [])
    .filter((t) => !q || t.title.toLowerCase().includes(q) || !!matchTag(t))
    .sort((a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime())
    .slice(0, 8)
    .map((t) => {
      const tag = q && !t.title.toLowerCase().includes(q) ? matchTag(t) : null
      return {
        key: 't:' + t.id,
        glyph: t.emoji,
        label: t.title,
        hint: tag ? `#${tag}` : formatDueLabel(t.due, t.dueTime) || 'Task',
        run: () => navigate({ to: '/tasks/$id', params: { id: t.id } }),
      }
    })

  const quickAdd = (title: string) => {
    createTask.mutate(
      {
        title,
        emoji: '📝',
        due: dateString(new Date()),
        dueTime: null,
        strictDeadline: false,
        repeat: 'No Repeat',
        repeatInterval: 1,
        repeatUnit: 'day',
        repeatWeekdays: [false, false, false, false, false, false, false],
        timeFrame: 30,
        timekeeperId: null,
        timeframeType: 'fixed',
        subtasks: [],
        notes: null,
        tags: [],
      },
      // Clear only on success so a failed create keeps the typed title.
      {
        onSuccess: () => {
          setQuery('')
          setSelected(0)
        },
      },
    )
  }

  const createItems: Item[] = query.trim()
    ? [
        {
          key: 'quick-add',
          glyph: '⚡',
          label: `Quick-add "${query.trim()}" for today`,
          hint: 'New',
          keepOpen: true,
          run: () => quickAdd(query.trim()),
        },
        {
          key: 'create',
          glyph: '＋',
          label: `Create "${query.trim()}"…`,
          hint: 'Form',
          run: () =>
            navigate({ to: '/new-task', search: { title: query.trim() } }),
        },
      ]
    : []

  const exportTasks = () => {
    const tasks = tasksQuery.data ?? []
    if (tasks.length === 0) return
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'do-this-now-tasks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const todayMs = startOfToday().getTime()
  const overdue = (tasksQuery.data ?? []).filter(
    (t) => !isSnoozed(t) && newSafeDate(t.due).getTime() < todayMs,
  )

  const snoozeOverdue = async () => {
    const ok = await confirm({
      message: `Snooze all ${overdue.length} overdue task${overdue.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Snooze all',
    })
    if (!ok) return
    for (const t of overdue) snoozeTask.mutate({ id: t.id })
  }

  const actions: Item[] = [
    ...(overdue.length > 0
      ? [
          {
            key: 'a:snooze-overdue',
            glyph: '☾',
            label: `Snooze all ${overdue.length} overdue`,
            hint: 'Action',
            run: () => void snoozeOverdue(),
          },
        ]
      : []),
    {
      key: 'a:export',
      glyph: '⤓',
      label: 'Export tasks (JSON)',
      hint: 'Action',
      run: exportTasks,
    },
    {
      key: 'a:signout',
      glyph: '⏻',
      label: 'Sign out',
      hint: 'Action',
      run: () => void signOut(),
    },
  ]

  const results = [
    ...pages.filter((p) => !q || p.label.toLowerCase().includes(q)),
    ...taskItems,
    ...createItems,
    ...actions.filter((a) => !q || a.label.toLowerCase().includes(q)),
  ]
  const active = Math.min(selected, Math.max(0, results.length - 1))

  const activate = (item: Item | undefined) => {
    if (!item) return
    if (!item.keepOpen) close()
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
    } else if (e.key === 'Tab') {
      // Trap focus: navigation is via arrows, so keep it on the input
      // rather than letting Tab escape the modal to the page behind it.
      e.preventDefault()
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
        <div className="sr-only" aria-live="polite">
          {query ? `${results.length} result${results.length === 1 ? '' : 's'}` : ''}
        </div>
        <ul
          aria-label="Results"
          className="max-h-[50vh] overflow-y-auto py-2"
        >
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
