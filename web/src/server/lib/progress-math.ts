import {
  dateString,
  newSafeDate,
  nextDueDate,
  repeatFrequencyDays,
} from '@dtn/shared/helpers'
import type { Task } from '@dtn/shared/schema'

// Pure scheduling/target math behind the progress bar. Kept free of any DB or
// request access so it can be unit-tested; progress.ts loads the inputs and
// persists the rollover around computeProgress().

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

export type ProgressInputs = {
  completedTodayMin: number
  streakBeforeToday: number
  lives: number
  allTasks: Array<Task>
}

export type ProgressComputation = {
  result: ProgressTodayResult
  rolloverLives: number | null // not null = streak hit, persist for tomorrow
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

function findMinimumDaysNeeded(
  today: Date,
  allTasks: Array<Task>,
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

export function computeProgress(
  today: Date,
  inputs: ProgressInputs,
): ProgressComputation {
  const { completedTodayMin: done, streakBeforeToday, lives, allTasks } = inputs

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
