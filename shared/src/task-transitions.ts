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

// "Full" completion — the user pressed Done with no remaining subtasks
// to advance. This is the path that consumes the timer value and writes
// 1+ history rows. Subtask-advance keeps using completeTaskTransition.
export type FullCompletionInput = {
  task: Task
  actualSeconds: number
  now: Date
  // When false, skip the fluid EMA update entirely — the user explicitly
  // chose "don't count this measurement" in the over/under confirm. The
  // task still completes, history rows still write; only the running
  // estimate is preserved as-is. Default true (normal completion path).
  countMeasurement?: boolean
}

export type FullCompletionResult = {
  // How many history rows to write — 1 for fluid / 0-time-frame / one-shot,
  // 1 + floor(over-target) for repeating fixed.
  completions: number
  // Snapshot of the task as it was when Done was clicked. All N history
  // rows share this snapshot.
  snapshot: Task
  // Actual seconds to record on each history row. Fluid records the full
  // session in row 1. Fixed credits `target × 60` per row so the day's
  // progress total is N × target. One-shot fixed records full session.
  actualSecondsPerRow: number
  // For repeating fixed: leftover after N × target. Seeded onto the next
  // instance's `timerAccumulatedSeconds` so the user picks up where they
  // left off tomorrow.
  carryoverSeconds: number
  // The post-state of the task. `null` ⇒ delete the row.
  nextTask: Task | null
}

function resetSubtasksForNext(task: Task): SubTask[] {
  return task.subtasks.map((s) => ({ ...s, done: false, snooze: undefined }))
}

export function applyFullCompletion(
  input: FullCompletionInput,
): FullCompletionResult {
  const { task, now } = input
  const actualSeconds = Math.max(0, input.actualSeconds)
  const countMeasurement = input.countMeasurement ?? true
  const repeating = task.repeat !== 'No Repeat'

  // Children of a timekeeper have no timer of their own. Treat their
  // completion as a 1× advance with 0 seconds credit — the keeper's own
  // completion is what drives the day's progress for this group of tasks.
  if (task.timekeeperId !== null || task.timeFrame === 0) {
    const nextDue = repeating ? nextDueDate(task) : undefined
    if (!nextDue) {
      return {
        completions: 1,
        snapshot: task,
        actualSecondsPerRow: 0,
        carryoverSeconds: 0,
        nextTask: null,
      }
    }
    return {
      completions: 1,
      snapshot: task,
      actualSecondsPerRow: 0,
      carryoverSeconds: 0,
      nextTask: {
        ...task,
        due: dateString(nextDue),
        subtasks: resetSubtasksForNext(task),
        updatedAt: now,
      },
    }
  }

  // Fluid: 1 completion. Update the time-frame via the 14-period EMA
  // bootstrap (n<14 = true running avg, n≥14 = 13/14 EMA) and bump the
  // measurement counter. The user-facing "don't count" choice in the
  // over/under confirm sets countMeasurement=false to skip the update —
  // useful when the timer ran wrong (forgot to pause / forgot to start)
  // and recording it would pollute the estimate. Zero seconds DOES count
  // when countMeasurement is true: completing an overdue instance with 0
  // pulls the average down to reflect that the work was front-loaded.
  if (task.timeframeType === 'fluid') {
    let newTimeFrame = task.timeFrame
    let newMeasurementCount = task.measurementCount
    if (countMeasurement) {
      const actualMinutes = actualSeconds / 60
      const n = task.measurementCount
      if (n === 0) newTimeFrame = actualMinutes
      else if (n < 14)
        newTimeFrame = (task.timeFrame * n + actualMinutes) / (n + 1)
      else newTimeFrame = (task.timeFrame * 13 + actualMinutes) / 14
      newMeasurementCount = Math.min(14, n + 1)
    }
    const nextDue = repeating ? nextDueDate(task) : undefined
    if (!nextDue) {
      return {
        completions: 1,
        snapshot: task,
        actualSecondsPerRow: actualSeconds,
        carryoverSeconds: 0,
        nextTask: null,
      }
    }
    return {
      completions: 1,
      snapshot: task,
      actualSecondsPerRow: actualSeconds,
      carryoverSeconds: 0,
      nextTask: {
        ...task,
        due: dateString(nextDue),
        subtasks: resetSubtasksForNext(task),
        timeFrame: newTimeFrame,
        measurementCount: newMeasurementCount,
        timerStartedAt: null,
        timerAccumulatedSeconds: 0,
        updatedAt: now,
      },
    }
  }

  // Fixed. One-shot: 1 row crediting the full session; delete.
  const targetMinutes = task.timeFrame
  const targetSeconds = targetMinutes * 60
  if (!repeating) {
    return {
      completions: 1,
      snapshot: task,
      actualSecondsPerRow: actualSeconds,
      carryoverSeconds: 0,
      nextTask: null,
    }
  }
  // Repeating fixed: floor(timer / target) completions today, carry the
  // remainder into the next instance's timer. Always at least 1 — the UI
  // guards Done until timer ≥ target, but defend in case the server is
  // hit directly with a sub-target value (allow it but credit 1×).
  const completions =
    targetSeconds > 0
      ? Math.max(1, Math.floor(actualSeconds / targetSeconds))
      : 1
  const carryoverSeconds = Math.max(
    0,
    actualSeconds - completions * targetSeconds,
  )

  // Advance N times by iterating nextDueDate so Weekdays / Custom-week
  // repeats step through the right calendar — adding completions*interval
  // days directly would skip those rules.
  let advanced = task
  for (let i = 0; i < completions; i++) {
    const due = nextDueDate(advanced)
    if (!due) break
    advanced = { ...advanced, due: dateString(due) }
  }

  return {
    completions,
    snapshot: task,
    actualSecondsPerRow: targetSeconds,
    carryoverSeconds,
    nextTask: {
      ...advanced,
      subtasks: resetSubtasksForNext(task),
      timerStartedAt: null,
      timerAccumulatedSeconds: carryoverSeconds,
      updatedAt: now,
    },
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
