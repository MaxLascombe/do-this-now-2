import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { minutesToHours } from '@dtn/shared/time'
import { type Task } from '@dtn/shared/types'
import { memo } from 'react'

const OVERDUE = '#fb7185'

const TaskRowBase = ({
  task,
  selected = false,
  dim = false,
  kbd,
  onClick,
  onMouseEnter,
}: {
  task: Task
  selected?: boolean
  dim?: boolean
  kbd?: string
  onClick?: () => void
  onMouseEnter?: () => void
}) => {
  const subtaskCount = task.subtasks?.length ?? 0
  const doneCount = task.subtasks?.filter((s) => s.done).length ?? 0
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
      const dueDate = new Date(task.due)
      return dueDate.getTime() < today.getTime()
    } catch {
      return false
    }
  })()

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={
        'flex w-full items-center gap-4 rounded-2xl border px-5 py-3 text-left font-mono transition-colors ' +
        (selected
          ? 'border-zinc-100 bg-zinc-50 text-zinc-950'
          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900') +
        (dim ? ' opacity-70' : '')
      }
    >
      <span className="text-2xl leading-none">{task.emoji}</span>
      <div className="min-w-0 flex-1">
        <div
          className={
            'truncate ' +
            (selected
              ? 'dtn-task-title text-zinc-950'
              : 'font-mono text-zinc-100')
          }
          style={{
            fontSize: selected ? '1.5rem' : '1.1rem',
            lineHeight: 1.15,
          }}
        >
          {task.title}
        </div>
        <div
          className={
            'mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs ' +
            (selected ? 'text-zinc-600' : 'text-zinc-500')
          }
        >
          {dueLabel && (
            <span>
              {isOverdue && (
                <span style={{ color: selected ? '#9f1239' : OVERDUE }}>‼ </span>
              )}
              {dueLabel}
            </span>
          )}
          {task.timeFrame ? <span>{minutesToHours(task.timeFrame)}</span> : null}
          {repeatLabel && <span>↻ {repeatLabel}</span>}
          {subtaskCount > 0 && (
            <span className="tabular-nums">
              ☐ {doneCount}/{subtaskCount}
            </span>
          )}
          {task.strictDeadline && (
            <span style={{ color: selected ? '#9f1239' : OVERDUE }}>strict</span>
          )}
        </div>
      </div>
      {kbd && (
        <kbd
          className={
            'rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ' +
            (selected
              ? 'border-zinc-300 bg-black/10 text-zinc-900'
              : 'border-zinc-800 bg-zinc-900 text-zinc-300')
          }
        >
          {kbd}
        </kbd>
      )}
    </button>
  )
}

export const TaskRow = memo(TaskRowBase)
