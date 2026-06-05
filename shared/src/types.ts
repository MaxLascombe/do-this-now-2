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

// Fixed: timeFrame is the target; over/under-runs carry into the next instance.
// Fluid: timeFrame is the latest estimate; on completion we update it via a
// 14-period EMA bootstrap (see shared/queries / server completion logic).
export type TimeframeType = 'fixed' | 'fluid'

export type Task = {
  id: string
  userId: string
  title: string
  emoji: string
  due: string
  dueTime: string | null
  strictDeadline: boolean
  repeat: RepeatOption
  repeatInterval: number
  repeatUnit: RepeatUnit
  repeatWeekdays: RepeatWeekdays
  // Stored as decimal minutes (e.g. 30.42). UI rounds up for display.
  // When 0, `timekeeperId` must be set — the task's time is tracked by
  // another task. Otherwise `timekeeperId` is null.
  timeFrame: number
  timekeeperId: string | null
  timeframeType: TimeframeType
  // Per-task timer state. The current value is
  //   timerAccumulatedSeconds + (now - timerStartedAt) when running,
  //   timerAccumulatedSeconds                            when paused.
  timerStartedAt: Date | null
  timerAccumulatedSeconds: number
  // How many fluid completions have fed into timeFrame so far, capped at
  // 14. Drives the EMA bootstrap: <14 = true running average, ≥14 = EMA.
  measurementCount: number
  snooze: string | null
  notes: string | null
  tags: string[]
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
  // The timer value at completion, in seconds. Null on legacy rows from
  // before the timer feature — read those as `taskSnapshot.timeFrame * 60`.
  actualSeconds: number | null
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
  heatmap: Array<{ date: string; minutes: number; hit: boolean }>
  currentStreak: number
  longestStreak: number
  totalDaysHit: number
  last30Days: Array<{ date: string; minutes: number }>
  hourOfDay: number[]
  dayOfWeek: number[]
  topTasks: Array<{ title: string; emoji: string; count: number }>
  emojiFreq: Array<{ emoji: string; count: number }>
  tagTime: Array<{ tag: string; minutes: number }>
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
