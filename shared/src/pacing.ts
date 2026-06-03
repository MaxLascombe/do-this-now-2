import { MINUTES_IN_DAY, START_OF_DAY_MINUTES } from './time'

export type Schedule = {
  shouldBeDone: number
  isBeforeWorkday: boolean
}

// How many minutes "should" be done by `now`, pacing the day's target linearly
// from the start of the workday to midnight (clamped to that window).
export function computeSchedule(
  now: Date,
  todo: number,
  minutesToReduceTomorrowDays: number,
): Schedule {
  const maxTodo = Math.max(todo, minutesToReduceTomorrowDays)
  const timeOfDay = now.getHours() * 60 + now.getMinutes()
  const pctOfDay = Math.max(
    0,
    Math.min(
      1,
      (timeOfDay - START_OF_DAY_MINUTES) /
        (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
    ),
  )
  return {
    shouldBeDone: maxTodo * pctOfDay,
    isBeforeWorkday: timeOfDay < START_OF_DAY_MINUTES,
  }
}
