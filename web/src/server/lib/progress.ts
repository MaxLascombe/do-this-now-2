import { and, eq, gte, lt } from 'drizzle-orm'

import { db } from '../../db'
import { dailyProgress, history, tasks, type Task } from '@dtn/shared/schema'
import {
  dateString,
  getUserToday,
  nextDueDate,
  newSafeDate,
} from '@dtn/shared/helpers'
import { DAY_MS } from '@dtn/shared/time'

// "todo" target floor: never report less than this many minutes of work for
// the day even if the actual due tasks total less — keeps the bar moving.
const TODO_FLOOR_MIN = 15.5 * 60
// Buffer subtracted from the rolling todo to smooth out a perfect-zero day.
const TODO_BUFFER_MIN = 60
// Rolling-horizon window for the per-day todo target. Longer = smoother
// daily target but slower to react to changes; shorter = reactive but noisy.
const TODO_HORIZON_DAYS = 14

export type ProgressTodayResult = {
  done: number
  lives: number
  todo: number
  streak: number
  streakIsActive: boolean
  theoreticalMinimum: number
  daysUntilAllDone: number
  minutesToReduceTomorrowDays: number
}

function calculateTodoForDays(
  today: Date,
  days: number,
  allTasks: Task[],
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
      let repeatFrequency = 1
      if (task.repeat === 'Daily') repeatFrequency = 1
      else if (task.repeat === 'Weekdays') repeatFrequency = 7 / 5
      else if (task.repeat === 'Weekly') repeatFrequency = 7
      else if (task.repeat === 'Monthly') repeatFrequency = 30
      else if (task.repeat === 'Yearly') repeatFrequency = 365
      else if (task.repeat === 'Custom') {
        if (task.repeatUnit === 'day') repeatFrequency = task.repeatInterval
        else if (task.repeatUnit === 'week') {
          if (task.repeatWeekdays.some((x) => x)) {
            const selected = task.repeatWeekdays.filter((x) => x).length
            repeatFrequency = (7 * task.repeatInterval) / selected
          } else {
            repeatFrequency = 7 * task.repeatInterval
          }
        } else if (task.repeatUnit === 'month')
          repeatFrequency = 30 * task.repeatInterval
        else if (task.repeatUnit === 'year')
          repeatFrequency = 365 * task.repeatInterval
      }
      theoreticalMinimum += time / repeatFrequency
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

function findMinimumDaysNeeded(
  today: Date,
  allTasks: Task[],
  done: number,
  cappedTodo: number,
): number {
  let days = 14
  let { todo } = calculateTodoForDays(today, days, allTasks, done)
  if (todo <= cappedTodo) return 14

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

function findMinutesOnTargetDay(
  today: Date,
  allTasks: Task[],
  daysUntilAllDone: number,
): number {
  const target = new Date(today)
  target.setDate(target.getDate() + daysUntilAllDone + 1)
  let minutes = 0

  for (const task of allTasks) {
    const time = task.timeFrame
    const due = newSafeDate(task.due)

    if (due.getTime() === target.getTime()) minutes += time

    if (task.repeat === 'No Repeat') continue

    let isDueOnTarget = false
    if (task.repeat === 'Daily') isDueOnTarget = true
    else if (task.repeat === 'Weekdays') {
      const dow = target.getDay()
      isDueOnTarget = dow >= 1 && dow <= 5
    } else if (task.repeat === 'Weekly')
      isDueOnTarget = due.getDay() === target.getDay()
    else if (task.repeat === 'Monthly')
      isDueOnTarget = due.getDate() === target.getDate()
    else if (task.repeat === 'Yearly')
      isDueOnTarget =
        due.getDate() === target.getDate() && due.getMonth() === target.getMonth()
    else if (task.repeat === 'Custom') {
      if (task.repeatUnit === 'day') {
        const daysDiff = Math.floor(
          (target.getTime() - due.getTime()) / DAY_MS,
        )
        isDueOnTarget = daysDiff >= 0 && daysDiff % task.repeatInterval === 0
      } else if (task.repeatUnit === 'week') {
        if (task.repeatWeekdays.some((x) => x)) {
          isDueOnTarget = task.repeatWeekdays[target.getDay()] === true
        } else {
          isDueOnTarget = due.getDay() === target.getDay()
        }
      } else if (task.repeatUnit === 'month')
        isDueOnTarget = due.getDate() === target.getDate()
      else if (task.repeatUnit === 'year')
        isDueOnTarget =
          due.getDate() === target.getDate() && due.getMonth() === target.getMonth()
    }

    if (isDueOnTarget) minutes += time
  }

  return minutes
}

// --- internal helpers -------------------------------------------------

type ProgressInputs = {
  completedTodayMin: number
  streakBeforeToday: number
  lives: number
  allTasks: Task[]
}

async function loadProgressInputs(
  userId: string,
  todayKey: string,
  todayUtcStart: Date,
  tomorrowUtcStart: Date,
): Promise<ProgressInputs> {
  const [completedToday, [todayProgress], allTasks] = await Promise.all([
    db
      .select()
      .from(history)
      .where(
        and(
          eq(history.userId, userId),
          gte(history.completedAt, todayUtcStart),
          lt(history.completedAt, tomorrowUtcStart),
        ),
      ),
    db
      .select()
      .from(dailyProgress)
      .where(
        and(
          eq(dailyProgress.userId, userId),
          eq(dailyProgress.date, todayKey),
        ),
      ),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
  ])

  const completedTodayMin = completedToday.reduce(
    (acc, row) => acc + (row.taskSnapshot.timeFrame ?? 0),
    0,
  )

  return {
    completedTodayMin,
    streakBeforeToday: todayProgress?.streakBeforeToday ?? 0,
    lives: todayProgress?.lives ?? 0,
    allTasks,
  }
}

type ProgressComputation = {
  result: ProgressTodayResult
  rolloverLives: number | null // not null = streak hit, persist for tomorrow
  rolloverStreak: number
}

function computeProgress(
  today: Date,
  inputs: ProgressInputs,
): ProgressComputation {
  const { completedTodayMin: done, streakBeforeToday, lives, allTasks } =
    inputs

  const { todo, theoreticalMinimum } = calculateTodoForDays(
    today,
    TODO_HORIZON_DAYS,
    allTasks,
    done,
  )
  const cappedTodo = Math.min(
    todo,
    Math.max(theoreticalMinimum + TODO_BUFFER_MIN, TODO_FLOOR_MIN),
  )
  const daysUntilAllDone = findMinimumDaysNeeded(
    today,
    allTasks,
    done,
    cappedTodo,
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
      theoreticalMinimum,
      daysUntilAllDone,
      minutesToReduceTomorrowDays: minutesOnTargetDay,
    },
    rolloverLives,
    rolloverStreak: streak,
  }
}

async function persistStreakRollover(
  userId: string,
  tomorrowKey: string,
  streak: number,
  lives: number,
): Promise<void> {
  await db
    .insert(dailyProgress)
    .values({ userId, date: tomorrowKey, streakBeforeToday: streak, lives })
    .onConflictDoUpdate({
      target: [dailyProgress.userId, dailyProgress.date],
      set: { streakBeforeToday: streak, lives },
    })
}

// --- public entry point -----------------------------------------------

export async function getProgressToday(
  userId: string,
  tzOffsetMin: number,
): Promise<ProgressTodayResult> {
  const { todayDate: today, todayKey, todayUtcStart, tomorrowUtcStart } =
    getUserToday(tzOffsetMin)
  const tomorrowKey = dateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  )

  const inputs = await loadProgressInputs(
    userId,
    todayKey,
    todayUtcStart,
    tomorrowUtcStart,
  )
  const { result, rolloverLives, rolloverStreak } = computeProgress(
    today,
    inputs,
  )
  if (rolloverLives !== null) {
    await persistStreakRollover(userId, tomorrowKey, rolloverStreak, rolloverLives)
  }
  return result
}
