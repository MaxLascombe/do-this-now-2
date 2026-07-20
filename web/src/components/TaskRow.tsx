import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { newSafeDate } from '@dtn/shared/helpers'
import { minutesToHours } from '@dtn/shared/time'
import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Task } from '@dtn/shared/types'

const OVERDUE = '#fb7185'

export type RowMenuItem = {
  label: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
}

// The row's overflow menu (⋯) — holds the secondary actions (Edit, Delete) so
// the row keeps only its primary buttons. Escape is captured so it closes the
// menu rather than firing the page's Escape shortcut.
export const RowMenu = ({ items }: { items: Array<RowMenuItem> }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="More actions"
        title="More actions"
        className={
          'shrink-0 rounded-full border px-3 py-1.5 font-mono text-xs leading-none transition-colors ' +
          (open
            ? 'border-zinc-600 text-zinc-100'
            : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100')
        }
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[7.5rem] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 py-1 shadow-xl shadow-black/60"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={
                'block w-full px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ' +
                (item.danger
                  ? 'text-rose-400 hover:text-rose-300'
                  : 'text-zinc-300 hover:text-zinc-100')
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// A compact inline action for a task row (Done / Snooze / Edit / Delete …).
// Shared so Home's Top Tasks and the Tasks list render identical buttons.
export const RowAction = ({
  label,
  icon,
  onClick,
  disabled,
  title,
}: {
  // The label survives as the accessible name when an icon renders.
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) => (
  <button
    type="button"
    disabled={disabled}
    title={title ?? (icon ? label : undefined)}
    aria-label={label}
    onClick={onClick}
    className={
      'flex shrink-0 items-center justify-center rounded-full border border-zinc-800 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-400 ' +
      (icon ? 'px-2.5 py-2' : 'px-3 py-1.5')
    }
  >
    {icon ?? label}
  </button>
)

// A single task as a rectangle: emoji + title + chips on a clickable body,
// with an optional inline `actions` cluster (buttons) to the right. `rank`
// prints a leading number (its focus-jump key); `selected` draws the keyboard
// cursor's ring. Callers that pass no `actions` get a plain clickable row.
const TaskRowBase = ({
  task,
  selected = false,
  dim = false,
  kbd,
  rank,
  actions,
  onClick,
  onMouseEnter,
}: {
  task: Task
  selected?: boolean
  dim?: boolean
  kbd?: string
  rank?: number
  actions?: ReactNode
  onClick?: () => void
  onMouseEnter?: () => void
}) => {
  const subtaskCount = task.subtasks.length
  const doneCount = task.subtasks.filter((s) => s.done).length
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )
  const isOverdue = (() => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const dueDate = newSafeDate(task.due)
      return dueDate.getTime() < today.getTime()
    } catch {
      return false
    }
  })()

  return (
    // Narrow screens stack: the task on one line, its actions on the next —
    // both still inside the one box. Side-by-side from md up, where there's
    // room for the buttons without crushing the title.
    <div
      className={
        'flex w-full flex-col rounded-2xl border bg-zinc-900/60 transition-colors md:flex-row md:items-center md:gap-2 md:pr-3 ' +
        (selected
          ? 'border-zinc-400 ring-1 ring-zinc-400/60'
          : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900') +
        (dim ? ' opacity-70' : '')
      }
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left font-mono md:pr-0"
      >
        {rank != null && (
          <span
            className="w-4 shrink-0 text-center text-sm tabular-nums text-zinc-600"
            aria-hidden="true"
          >
            {rank}
          </span>
        )}
        <span className="relative text-2xl leading-none">
          <span aria-hidden="true">{task.emoji}</span>
          {task.timerStartedAt && (
            <span
              className="absolute -top-1 -right-1 h-2 w-2 rounded-full"
              style={{
                background: '#34d399',
                boxShadow: '0 0 6px rgba(52,211,153,0.7)',
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
              role="img"
              aria-label="Timer running"
              title="Timer running"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div
            className="truncate font-mono text-zinc-100"
            style={{ fontSize: '1.1rem', lineHeight: 1.15 }}
          >
            {task.title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-zinc-500">
            {dueLabel && (
              <span
                title={isOverdue ? 'Overdue' : undefined}
                style={isOverdue ? { color: OVERDUE } : undefined}
              >
                {dueLabel}
              </span>
            )}
            {task.timeFrame ? (
              <span>{minutesToHours(task.timeFrame)}</span>
            ) : null}
            {repeatLabel && (
              <span>
                <span aria-hidden="true">↻ </span>
                {repeatLabel}
              </span>
            )}
            {subtaskCount > 0 && (
              <span
                className="tabular-nums"
                aria-label={`${doneCount} of ${subtaskCount} ${subtaskCount === 1 ? 'subtask' : 'subtasks'} done`}
              >
                ☐ {doneCount}/{subtaskCount}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </div>
        </div>
        {kbd && (
          <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300 tabular-nums">
            {kbd}
          </kbd>
        )}
      </button>
      {actions && (
        <div className="flex shrink-0 items-center gap-2 px-4 pb-3 md:px-0 md:pb-0">
          {actions}
        </div>
      )}
    </div>
  )
}

export const TaskRow = memo(TaskRowBase)
