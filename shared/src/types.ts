// Pure TS types — safe to import from React Native (no Drizzle runtime).

export type RepeatOption =
  | 'No Repeat'
  | 'Daily'
  | 'Weekdays'
  | 'Weekly'
  | 'Monthly'
  | 'Yearly'
  | 'Custom'

export type RepeatUnit = 'day' | 'week' | 'month' | 'year'

export type RepeatWeekdays = [
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
]

export type SubTask = { title: string; done: boolean; snooze?: string }

export type Task = {
  id: string
  userId: string
  title: string
  emoji: string
  due: string
  strictDeadline: boolean
  repeat: RepeatOption
  repeatInterval: number
  repeatUnit: RepeatUnit
  repeatWeekdays: RepeatWeekdays
  timeFrame: number
  snooze: string | null
  subtasks: SubTask[]
  createdAt: Date
  updatedAt: Date
}

export type NewTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: Date
  updatedAt?: Date
}

export type HistoryEntry = {
  id: string
  userId: string
  taskId: string | null
  taskSnapshot: Task
  completedAt: Date
}

export type NewHistoryEntry = Omit<HistoryEntry, 'id'> & { id?: string }

export type DailyProgress = {
  userId: string
  date: string
  streakBeforeToday: number
  lives: number
}

export type NewDailyProgress = DailyProgress
