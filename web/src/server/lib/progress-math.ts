import {
  dateString,
  newSafeDate,
  nextDueDate,
  repeatFrequencyDays,
} from '@dtn/shared/helpers'
import type { Task } from '@dtn/shared/schema'
import type { UserSettings } from '@dtn/shared/settings'
import type { RecapDay } from '@dtn/shared/types'

// Pure scheduling/target math behind the progress bar. Kept free of any DB or
// request access so it can be unit-tested; progress.ts loads the inputs and
// persists the rollover around computeProgress().

// Buffer added to the recurring steady-state when capping the target, so the
// target always sits above steady-state and backlog keeps draining.
const TODO_BUFFER_MIN = 60

// Lazy settlement walks at most this many absent days; a longer gap means the
// chain is dead regardless (a bank that survives 400 unattended targets does
// not happen) and gets seeded to zero instead of walked.
export const MAX_SETTLE_DAYS = 400

export type ProgressTodayResult = {
  done: number
  lives: number
  todo: number
  streak: number
  streakIsActive: boolean
  bestStreak: number
  theoreticalMinimum: number
  daysUntilAllDone: number
  minutesToReduceTomorrowDays: number
  workdayStartMin: number
  workdayEndMin: number
  horizonDays: number
}

export type ProgressInputs = {
  completedTodayMin: number
  streakBeforeToday: number
  lives: number
  bestStreakBefore: number
  allTasks: Array<Task>
  settings: UserSettings
}

export type ProgressComputation = {
  result: ProgressTodayResult
  rolloverLives: number | null // not null = day won, persist for tomorrow
  rolloverStreak: number
}

function calculateTodoForDays(
  today: Date,
  days: number,
  allTasks: Array<Task>,
  done: number,
) {
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)

  let totalTimeInPeriod = 0
  let theoreticalMinimum = 0

  for (const task of allTasks) {
    const time = task.timeFrame
    let due: Date | undefined = newSafeDate(task.due)

    if (task.repeat !== 'No Repeat') {
      theoreticalMinimum += time / repeatFrequencyDays(task)
    }

    while (due !== undefined && due <= endDate) {
      totalTimeInPeriod += time
      if (task.repeat === 'No Repeat') break
      due = nextDueDate({ ...task, due: dateString(due) })
    }
  }

  const todo = Math.ceil((totalTimeInPeriod + done) / days)
  return { todo, theoreticalMinimum: Math.ceil(theoreticalMinimum) }
}

// The Daily Target for one day: due work averaged over the horizon, capped so
// it never exceeds the Workday's length unless recurring load alone demands
// more (then steady-state + buffer, so backlog still drains).
export function computeDayTarget(
  day: Date,
  allTasks: Array<Task>,
  done: number,
  settings: UserSettings,
) {
  const { todo, theoreticalMinimum } = calculateTodoForDays(
    day,
    settings.horizonDays,
    allTasks,
    done,
  )
  const workdayLen = Math.max(1, settings.workdayEndMin - settings.workdayStartMin)
  const cappedTodo = Math.min(
    todo,
    Math.max(theoreticalMinimum + TODO_BUFFER_MIN, workdayLen),
  )
  return { cappedTodo, theoreticalMinimum }
}

function findMinimumDaysNeeded(
  today: Date,
  allTasks: Array<Task>,
  done: number,
  cappedTodo: number,
  horizonDays: number,
): number {
  let days = horizonDays
  let { todo } = calculateTodoForDays(today, days, allTasks, done)
  if (todo <= cappedTodo) return horizonDays

  while (todo > cappedTodo) {
    days *= 2
    todo = calculateTodoForDays(today, days, allTasks, done).todo
  }

  let lo = days / 2
  let hi = days
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2)
    todo = calculateTodoForDays(today, mid, allTasks, done).todo
    if (todo <= cappedTodo) hi = mid
    else lo = mid
  }
  return hi
}

export function findMinutesOnTargetDay(
  today: Date,
  allTasks: Array<Task>,
  daysUntilAllDone: number,
): number {
  const target = new Date(today)
  target.setDate(target.getDate() + daysUntilAllDone + 1)
  const targetMs = target.getTime()
  let minutes = 0

  for (const task of allTasks) {
    // Walk real occurrences via nextDueDate — calendar-pattern matching
    // ignored repeatInterval (every-2-weeks counted weekly) and month-length.
    let due: Date | undefined = newSafeDate(task.due)
    while (due !== undefined && due.getTime() < targetMs) {
      if (task.repeat === 'No Repeat') {
        due = undefined
        break
      }
      due = nextDueDate({ ...task, due: dateString(due) })
    }
    if (due !== undefined && due.getTime() === targetMs) minutes += task.timeFrame
  }

  return minutes
}

export type DayStart = { streakBeforeToday: number; lives: number }
export type DayOutcome = { done: number; todo: number }

// The Day Recap's raw material: for each of the last `maxDays` days before
// today, the verdict encoded by its NEXT day's daily_progress row (win
// rollovers always carry streakBeforeToday >= 1; settlement writes {0,0} on
// losses). Days without a next-day row (pre-feature, unsettled) are skipped.
export function buildRecap(
  today: Date,
  rows: Array<{ date: string; streakBeforeToday: number; lives: number }>,
  doneByDay: Map<string, number>,
  maxDays: number,
): Array<RecapDay> {
  const byKey = new Map(rows.map((r) => [r.date, r]))
  const out: Array<RecapDay> = []
  for (let i = 1; i <= maxDays; i++) {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - i,
    )
    const dayKey = dateString(day)
    const nextKey = dateString(
      new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1),
    )
    const next = byKey.get(nextKey)
    if (!next) continue
    const before = byKey.get(dayKey)
    out.push({
      date: dayKey,
      won: next.streakBeforeToday > 0,
      done: doneByDay.get(dayKey) ?? 0,
      livesBefore: before?.lives ?? 0,
      livesAfter: next.lives,
      streakBefore: before?.streakBeforeToday ?? 0,
      streakAfter: next.streakBeforeToday,
    })
  }
  return out
}

// Settle a run of past days oldest-first: each day's verdict produces the
// NEXT day's start state. A win banks the surplus and extends the streak; a
// loss zeroes both (the bank was played covering the shortfall and still came
// up short — full wipe by design).
export function settleChain(
  start: DayStart,
  days: Array<DayOutcome>,
): Array<DayStart> {
  const rows: Array<DayStart> = []
  let cur = start
  for (const day of days) {
    const hit = day.done + cur.lives >= day.todo
    cur = hit
      ? {
          streakBeforeToday: cur.streakBeforeToday + 1,
          lives: day.done + cur.lives - day.todo,
        }
      : { streakBeforeToday: 0, lives: 0 }
    rows.push(cur)
  }
  return rows
}

export function computeProgress(
  today: Date,
  inputs: ProgressInputs,
): ProgressComputation {
  const {
    completedTodayMin: done,
    streakBeforeToday,
    lives,
    bestStreakBefore,
    allTasks,
    settings,
  } = inputs

  const { cappedTodo, theoreticalMinimum } = computeDayTarget(
    today,
    allTasks,
    done,
    settings,
  )
  const daysUntilAllDone = findMinimumDaysNeeded(
    today,
    allTasks,
    done,
    cappedTodo,
    settings.horizonDays,
  )
  const minutesOnTargetDay = findMinutesOnTargetDay(
    today,
    allTasks,
    daysUntilAllDone,
  )

  const hitTarget = done + lives >= cappedTodo
  const streak = hitTarget ? streakBeforeToday + 1 : streakBeforeToday
  const rolloverLives = hitTarget ? done + lives - cappedTodo : null

  return {
    result: {
      done,
      lives,
      todo: cappedTodo,
      streak,
      streakIsActive: hitTarget,
      bestStreak: Math.max(bestStreakBefore, streak),
      theoreticalMinimum,
      daysUntilAllDone,
      minutesToReduceTomorrowDays: minutesOnTargetDay,
      workdayStartMin: settings.workdayStartMin,
      workdayEndMin: settings.workdayEndMin,
      horizonDays: settings.horizonDays,
    },
    rolloverLives,
    rolloverStreak: streak,
  }
}
