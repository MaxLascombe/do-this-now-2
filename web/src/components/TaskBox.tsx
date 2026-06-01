import { memo } from 'react'
import { DateTag, Repeat, Strict, TimeFrame } from './Tags'
import type { LegacyRef } from 'react'

import type { Task } from '@dtn/shared/types'

const TaskBoxBase = ({
  innerRef,
  isSelected,
  onClick,
  onMouseEnter,
  task,
  title,
}: {
  innerRef?: LegacyRef<HTMLButtonElement>
  isSelected: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  task: Task
  title?: string
}) => {
  const showSubtask = isSelected && task.subtasks.length > 0
  const subtasksDone = task.subtasks.reduce(
    (acc, s) => acc + (s.done ? 1 : 0),
    0,
  )

  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={
        (isSelected
          ? 'border-gray-700 bg-gray-900 text-white '
          : 'border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900 ') +
        'relative flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4 text-left outline-none ring-white ring-offset-0 ring-offset-black focus:z-10 focus:ring'
      }
      title={title}
      ref={innerRef ?? undefined}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{task.emoji}</span>
        <span>
          {showSubtask
            ? (task.subtasks.find(
                (s) =>
                  !s.done && (!s.snooze || new Date(s.snooze) < new Date()),
              )?.title ??
              task.subtasks.find((s) => !s.done)?.title ??
              task.title)
            : task.title}
        </span>
      </div>
      {showSubtask && (
        <div className="text-xs font-normal">
          {task.title} ({subtasksDone}/{task.subtasks.length})
        </div>
      )}
      <div
        className={
          (isSelected ? 'text-gray-300 ' : 'text-gray-600 ') +
          'flex flex-wrap gap-x-4'
        }
      >
        <DateTag due={task.due} dueTime={task.dueTime} />
        <TimeFrame timeFrame={task.timeFrame} />
        <Repeat
          repeat={task.repeat}
          repeatInterval={task.repeatInterval}
          repeatUnit={task.repeatUnit}
          repeatWeekdays={task.repeatWeekdays}
        />
        <Strict strictDeadline={task.strictDeadline} />
      </div>
    </button>
  )
}

// memo so selection-index changes only re-render the row whose
// isSelected actually flipped — not every row in the list.
export const TaskBox = memo(TaskBoxBase)
