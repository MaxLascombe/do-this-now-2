import type { Task, SubTask } from './types'
import { newSafeDate, nextDueDate } from './helpers'

const subtaskIsSnoozed = (s: SubTask) =>
  !!s.snooze && new Date(s.snooze) >= new Date()

// A subtask is "actionable" iff it isn't done AND isn't currently snoozed.
// completeTask + snoozeTask both reach for "the next actionable subtask";
// hoisted here so the predicate has one source of truth and is unit-testable
// without a DB.
export function isActionableSubtask(s: SubTask, now: Date): boolean {
  if (s.done) return false
  if (!s.snooze) return true
  return new Date(s.snooze) < now
}

// Returns the next subtask the user should action: prefer one that's
// actionable; fall back to the first not-done one (e.g. all remaining are
// snoozed but we still want to advance something). Undefined if all done.
export function findNextActionableSubtask(
  subtasks: SubTask[],
  now: Date,
): SubTask | undefined {
  return (
    subtasks.find((s) => isActionableSubtask(s, now)) ??
    subtasks.find((s) => !s.done)
  )
}

// "Will clicking Complete on this task actually finish the whole task?"
// — true if no subtasks or at most one undone subtask remains. Used by
// the optimistic-update layer to decide between hiding the row (whole
// task done) vs flipping one subtask to done in-place (task continues).
export function willCompletingFinishTheTask(task: Task): boolean {
  if (task.subtasks.length === 0) return true
  const undoneCount = task.subtasks.filter((s) => !s.done).length
  return undoneCount <= 1
}

// "Will clicking Snooze on this task remove it from the active list?"
// — yes if allSubtasks is set, if there are no subtasks, or if every
// subtask is already done (server snoozes the whole task in those cases).
// No otherwise — the server snoozes a single subtask and the task stays
// in the list.
export function willSnoozingRemoveTask(
  task: Task,
  allSubtasks: boolean,
): boolean {
  if (allSubtasks) return true
  if (task.subtasks.length === 0) return true
  return !task.subtasks.some((s) => !s.done)
}

export const isSnoozed = (t: Task): boolean => {
  if (t.snooze && new Date(t.snooze) >= new Date()) return true
  if (
    t.subtasks.length > 0 &&
    !t.subtasks.some((s) => !s.done && !subtaskIsSnoozed(s))
  )
    return true
  return false
}

const dueOrPastDue = (t: Task, today: Date): boolean =>
  newSafeDate(t.due) <= today

export const sortTasks = (tasks: Task[], today: Date): void => {
  const tmrw = new Date(today)
  tmrw.setDate(tmrw.getDate() + 1)
  const in2Days = new Date(today)
  in2Days.setDate(in2Days.getDate() + 2)

  const sortFlags: Array<(t: Task) => boolean> = [
    // not snoozed (true = higher priority)
    (t) => !isSnoozed(t),

    // due today or past due
    (t) => dueOrPastDue(t, today),

    // strict deadline and due today or past due
    (t) => dueOrPastDue(t, today) && t.strictDeadline,

    // completing this task means it won't come back for at least 2 days
    (t) => {
      if (!dueOrPastDue(t, today)) return false
      const next = nextDueDate(t)
      return next === undefined || next >= in2Days
    },

    // completing this task means it won't come back today
    (t) => {
      if (!dueOrPastDue(t, today)) return false
      const next = nextDueDate(t)
      return next === undefined || next >= tmrw
    },
  ]

  tasks.sort((a, b) => {
    for (const flag of sortFlags) {
      const fa = flag(a)
      const fb = flag(b)
      if (fa && !fb) return -1
      if (fb && !fa) return 1
    }

    // sort by due date
    const diff = newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime()
    if (diff !== 0) return diff

    // sort by time frame (0 = no estimate, goes last)
    if (a.timeFrame !== b.timeFrame) {
      if (a.timeFrame === 0) return 1
      if (b.timeFrame === 0) return -1
      return a.timeFrame - b.timeFrame
    }

    return 0
  })
}
