import { createServerFn } from '@tanstack/react-start'
import { and, eq, gte, lt } from 'drizzle-orm'

import { db } from '../db'
import { dailyProgress, history, tasks, type Task } from '../db/schema'
import { dateString, nextDueDate, newSafeDate } from '../lib/helpers'
import { requireUserId } from './auth'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const TODO_FLOOR_MIN = 15.5 * 60 // soft floor for the daily goal in minutes
const TODO_BUFFER_MIN = 60

type ProgressTodayResult = {
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
): { todo: number; theoreticalMinimum: number } {
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + days)

  let totalTimeInPeriod = 0
  let theoreticalMinimum = 0

  for (const task of allTasks) {
    const time = task.timeFrame
    if (task.due === 'No Due Date') continue
    let due: Date | undefined = newSafeDate(task.due)

    // Theoretical minimum (per-day load) for repeating tasks
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

    // Roll due forward repeatedly through the window summing minutes
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
    if (task.due === 'No Due Date') continue
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
          (target.getTime() - due.getTime()) / MS_PER_DAY,
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

export const getProgressToday = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProgressTodayResult> => {
    const userId = await requireUserId()
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayKey = dateString(today)
    const tomorrowKey = dateString(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
    )

    // Today's done = sum of timeFrames of tasks completed today
    const completedToday = await db
      .select()
      .from(history)
      .where(
        and(
          eq(history.userId, userId),
          gte(history.completedAt, today),
          lt(
            history.completedAt,
            new Date(
              today.getFullYear(),
              today.getMonth(),
              today.getDate() + 1,
            ),
          ),
        ),
      )
    let done = 0
    for (const row of completedToday) {
      const snap = row.taskSnapshot as Task
      done += snap.timeFrame ?? 0
    }

    // Today's daily_progress row gives streakBeforeToday + lives carried over
    const [todayProgress] = await db
      .select()
      .from(dailyProgress)
      .where(
        and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, todayKey)),
      )
    const streakBeforeToday = todayProgress?.streakBeforeToday ?? 0
    const lives = todayProgress?.lives ?? 0

    const allTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, userId))

    const { todo, theoreticalMinimum } = calculateTodoForDays(
      today,
      14,
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

    let streak = streakBeforeToday
    let streakIsActive = false

    if (done + lives >= cappedTodo) {
      streak += 1
      streakIsActive = true
      const newLives = done + lives - cappedTodo
      // Idempotent upsert: tomorrow inherits this streak + leftover lives
      await db
        .insert(dailyProgress)
        .values({
          userId,
          date: tomorrowKey,
          streakBeforeToday: streak,
          lives: newLives,
        })
        .onConflictDoUpdate({
          target: [dailyProgress.userId, dailyProgress.date],
          set: { streakBeforeToday: streak, lives: newLives },
        })
    }

    return {
      done,
      lives,
      todo: cappedTodo,
      streak,
      streakIsActive,
      theoreticalMinimum,
      daysUntilAllDone,
      minutesToReduceTomorrowDays: minutesOnTargetDay,
    }
  },
)
