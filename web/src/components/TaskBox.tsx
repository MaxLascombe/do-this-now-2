import { type LegacyRef, type KeyboardEvent } from 'react'

import { type Task } from '../db/schema'
import {
  DateTag,
  EditableDateTag,
  EditableTimeFrame,
  Repeat,
  Strict,
  TimeFrame,
} from './Tags'

export type TaskFieldUpdate =
  | { due: string }
  | { timeFrame: number }

export const TaskBox = ({
  innerRef,
  isSelected,
  onClick,
  onUpdate,
  task,
  title,
}: {
  innerRef?: LegacyRef<HTMLDivElement>
  isSelected: boolean
  onClick?: () => void
  onUpdate?: (update: TaskFieldUpdate) => void
  task: Task
  title?: string
}) => {
  const showSubtask = isSelected && task.subtasks.length > 0
  const subtasksDone = task.subtasks.reduce(
    (acc, s) => acc + (s.done ? 1 : 0),
    0,
  )

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      onClick={onClick}
      onKeyDown={onKey}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={
        (isSelected
          ? 'border-gray-700 bg-gray-900 text-white '
          : 'border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-gray-900 ') +
        'relative flex w-full max-w-sm flex-col gap-2 rounded-lg border p-4 text-left outline-none ring-white ring-offset-0 ring-offset-black focus:z-10 focus:ring'
      }
      title={title}
      ref={innerRef ?? undefined}
    >
      <div>
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
          'flex flex-wrap items-center gap-x-4 gap-y-1'
        }
      >
        {onUpdate ? (
          <EditableDateTag
            due={task.due}
            onChange={(due) => onUpdate({ due })}
          />
        ) : (
          <DateTag due={task.due} />
        )}
        {onUpdate ? (
          <EditableTimeFrame
            timeFrame={task.timeFrame}
            onChange={(timeFrame) => onUpdate({ timeFrame })}
          />
        ) : (
          <TimeFrame timeFrame={task.timeFrame} />
        )}
        <Repeat
          repeat={task.repeat}
          repeatInterval={task.repeatInterval}
          repeatUnit={task.repeatUnit}
          repeatWeekdays={task.repeatWeekdays}
        />
        <Strict strictDeadline={task.strictDeadline} />
      </div>
    </div>
  )
}
