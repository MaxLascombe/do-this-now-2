import type { Task, SubTask } from './types'
import { newSafeDate, nextDueDate } from './helpers'

const subtaskIsSnoozed = (s: SubTask) =>
  !!s.snooze && new Date(s.snooze) >= new Date()

export const isSnoozed = (t: Task): boolean => {
  if (t.snooze && new Date(t.snooze) >= new Date()) return true
  if (t.subtasks.length > 0 && !t.subtasks.some(s => !s.done && !subtaskIsSnoozed(s))) return true
  return false
}

const dueOrPastDue = (t: Task, today: Date): boolean =>
  t.due !== 'No Due Date' && newSafeDate(t.due) <= today

export const sortTasks = (tasks: Task[], today: Date): void => {
  const tmrw = new Date(today)
  tmrw.setDate(tmrw.getDate() + 1)
  const in2Days = new Date(today)
  in2Days.setDate(in2Days.getDate() + 2)

  const sortFlags: Array<(t: Task) => boolean> = [
    // not snoozed (true = higher priority)
    t => !isSnoozed(t),

    // due today or past due
    t => dueOrPastDue(t, today),

    // strict deadline and due today or past due
    t => dueOrPastDue(t, today) && t.strictDeadline,

    // completing this task means it won't come back for at least 2 days
    t => {
      if (!dueOrPastDue(t, today)) return false
      const next = nextDueDate(t)
      return next === undefined || next >= in2Days
    },

    // completing this task means it won't come back today
    t => {
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
    if (a.due !== 'No Due Date' && b.due !== 'No Due Date') {
      const diff = newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime()
      if (diff !== 0) return diff
    } else if (a.due !== 'No Due Date') {
      return -1
    } else if (b.due !== 'No Due Date') {
      return 1
    }

    // sort by time frame (0 = no estimate, goes last)
    if (a.timeFrame !== b.timeFrame) {
      if (a.timeFrame === 0) return 1
      if (b.timeFrame === 0) return -1
      return a.timeFrame - b.timeFrame
    }

    return 0
  })
}
