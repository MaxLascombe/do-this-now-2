import { dateString, nextDueDate } from './helpers'
import { findNextActionableSubtask } from './task-sorting'
import { HOUR_MS } from './time'
import type { SubTask, Task } from './types'

export type CompleteTransition =
  // Multi-subtask task where one subtask was ticked off; task remains.
  | { kind: 'advance-subtask'; nextTask: Task; advanced: false }
  // Whole task finished and not repeating; row is gone.
  | { kind: 'finish-and-delete'; snapshot: Task; advanced: true }
  // Whole task finished but repeats; row stays with new due + reset subtasks.
  | {
      kind: 'finish-and-reschedule'
      snapshot: Task
      nextTask: Task
      advanced: true
    }

export function completeTaskTransition(
  task: Task,
  now: Date = new Date(),
): CompleteTransition {
  let current = task
  if (current.subtasks.length > 0 && current.subtasks.some((s) => !s.done)) {
    const next = findNextActionableSubtask(current.subtasks, now)
    if (next) {
      const newSubtasks: SubTask[] = current.subtasks.map((s) =>
        s === next ? { ...s, done: true } : s,
      )
      const stillUndone = newSubtasks.some((s) => !s.done)
      if (stillUndone) {
        return {
          kind: 'advance-subtask',
          nextTask: { ...current, subtasks: newSubtasks, updatedAt: now },
          advanced: false,
        }
      }
      current = { ...current, subtasks: newSubtasks }
    }
  }

  const newDue = nextDueDate(current)
  if (current.repeat === 'No Repeat' || newDue === undefined) {
    return { kind: 'finish-and-delete', snapshot: current, advanced: true }
  }

  // Reset subtasks for the next occurrence — undo `done` and clear any
  // stale subtask snoozes from the previous cycle.
  const resetSubtasks: SubTask[] = current.subtasks.map((s) => ({
    ...s,
    done: false,
    snooze: undefined,
  }))
  return {
    kind: 'finish-and-reschedule',
    snapshot: current,
    nextTask: {
      ...current,
      due: dateString(newDue),
      subtasks: resetSubtasks,
      updatedAt: now,
    },
    advanced: true,
  }
}

export type SnoozeTransition = {
  scope: 'subtask' | 'task'
  nextTask: Task
}

export function snoozeTaskTransition(
  task: Task,
  allSubtasks: boolean,
  now: Date = new Date(),
): SnoozeTransition {
  const newSnooze = new Date(now.getTime() + HOUR_MS).toISOString()

  const next = allSubtasks
    ? undefined
    : findNextActionableSubtask(task.subtasks, now)

  if (next) {
    const newSubtasks: SubTask[] = task.subtasks.map((s) =>
      s === next ? { ...s, snooze: newSnooze } : s,
    )
    return {
      scope: 'subtask',
      nextTask: { ...task, subtasks: newSubtasks, updatedAt: now },
    }
  }

  return {
    scope: 'task',
    nextTask: { ...task, snooze: newSnooze, updatedAt: now },
  }
}
