import type { Task, SubTask } from '../db/schema'

// Parses a 'YYYY-M-D' date string into a local-time Date (avoids UTC offset issues)
export const newSafeDate = (str: string): Date => {
  const [year, month, day] = str.split('-').map(s => parseInt(s))
  return new Date(year, month - 1, day)
}

export const dateString = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

export const nextDueDate = (task: Task): Date | undefined => {
  if (task.repeat === 'No Repeat' || task.due === 'No Due Date') return undefined
  const date = newSafeDate(task.due)
  if (task.repeat === 'Daily') {
    date.setDate(date.getDate() + 1)
  } else if (task.repeat === 'Weekdays') {
    const daysToAdd = date.getDay() === 5 ? 3 : 1
    date.setDate(date.getDate() + daysToAdd)
  } else if (task.repeat === 'Weekly') {
    date.setDate(date.getDate() + 7)
  } else if (task.repeat === 'Monthly') {
    date.setMonth(date.getMonth() + 1)
  } else if (task.repeat === 'Yearly') {
    date.setFullYear(date.getFullYear() + 1)
  } else if (task.repeat === 'Custom') {
    if (task.repeatUnit === 'day') {
      date.setDate(date.getDate() + task.repeatInterval)
    } else if (task.repeatUnit === 'week') {
      const weekdays = task.repeatWeekdays
      if (!weekdays.some(x => x)) {
        date.setDate(date.getDate() + 7 * task.repeatInterval)
      } else {
        let i = (date.getDay() + 1) % 7
        while (!weekdays[i]) i = (i + 1) % 7
        if (i > date.getDay()) {
          date.setDate(date.getDate() + i - date.getDay())
        } else {
          date.setDate(date.getDate() + 7 * task.repeatInterval)
          date.setDate(date.getDate() + i - date.getDay())
        }
      }
    } else if (task.repeatUnit === 'month') {
      date.setMonth(date.getMonth() + task.repeatInterval)
    } else if (task.repeatUnit === 'year') {
      date.setFullYear(date.getFullYear() + task.repeatInterval)
    }
  }
  // shift by 2 hours to avoid midnight DST edge cases, then re-parse as local date
  date.setHours(date.getHours() + 2)
  return newSafeDate(dateString(date))
}

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
