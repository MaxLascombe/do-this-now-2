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

// Shape returned by GET /api/stats. Mirrors the lib's StatsResult — kept
// here so mobile + shared client code can type-import without depending
// on web's server tree.
export type StatsResult = {
  heatmap: Array<{ date: string; hit: boolean }>
  currentStreak: number
  longestStreak: number
  totalDaysHit: number
  last30Days: Array<{ date: string; minutes: number }>
  hourOfDay: number[]
  dayOfWeek: number[]
  topTasks: Array<{ title: string; emoji: string; count: number }>
  emojiFreq: Array<{ emoji: string; count: number }>
  onTimeRate: number | null
  avgLatencyDays: number | null
  totalAllTime: number
  totalThisMonth: number
  totalThisWeek: number
  totalToday: number
  snoozesAllTime: number
  snoozesThisWeek: number
  abandonedCount: number
  abandonmentRate: number | null
}
