import type { Task } from './types'

export const newSafeDate = (str: string): Date => {
  const [year, month, day] = str.split('-').map((s) => parseInt(s))
  return new Date(year, month - 1, day)
}

// Combines a YYYY-M-D `due` and HH:MM `dueTime` into a local Date.
// Caller decides what to compare against (local "now" on the client, or
// a tz-shifted "now" on the server — see getUserToday for the shift).
export const newSafeDateTime = (due: string, dueTime: string): Date => {
  const [year, month, day] = due.split('-').map((s) => parseInt(s))
  const [hh, mm] = dueTime.split(':').map((s) => parseInt(s))
  return new Date(year, month - 1, day, hh, mm)
}

export const dateString = (date: Date): string =>
  `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`

// Resolves "today" from the user's perspective given the client-supplied TZ
// offset (matches Date.prototype.getTimezoneOffset(): minutes west of UTC,
// e.g. +300 for EST). The server runs in UTC, so the naive new Date() trick
// flips dates once the user crosses into UTC tomorrow.
export const getUserToday = (
  tzOffsetMin: number,
  now: Date = new Date(),
) => {
  // Shift `now` so its UTC getters return the user's local Y/M/D.
  const localAsUtc = new Date(now.getTime() - tzOffsetMin * 60000)
  const year = localAsUtc.getUTCFullYear()
  const month = localAsUtc.getUTCMonth()
  const day = localAsUtc.getUTCDate()
  // todayDate uses server-local midnight (UTC midnight in prod) so it's
  // consistent with newSafeDate-parsed `due` values for arithmetic.
  const todayDate = new Date(year, month, day)
  const todayKey = `${year}-${month + 1}-${day}`
  // UTC instant of the user's local midnight (correct boundary for the
  // completed_at SQL filter).
  const utcStartMs = Date.UTC(year, month, day) + tzOffsetMin * 60000
  return {
    year,
    month,
    day,
    todayDate,
    todayKey,
    todayUtcStart: new Date(utcStartMs),
    tomorrowUtcStart: new Date(utcStartMs + 24 * 60 * 60 * 1000),
  }
}

// Returns a Date whose local (server-side) getters report the user's
// wall-clock Y/M/D/H/M — i.e. it's directly comparable to a Date built by
// newSafeDateTime() in the user's timezone. Server runs UTC, so we shift
// `now` by tzOffsetMin and pull the UTC fields out as if they were local.
export const getUserLocalNow = (
  tzOffsetMin: number,
  now: Date = new Date(),
): Date => {
  const shifted = new Date(now.getTime() - tzOffsetMin * 60000)
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    shifted.getUTCHours(),
    shifted.getUTCMinutes(),
    shifted.getUTCSeconds(),
    shifted.getUTCMilliseconds(),
  )
}

// Clamp the day to the target month's length so Jan 31 + 1mo → Feb 28, not a skipped month.
const addMonthsClamped = (date: Date, months: number): void => {
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const daysInMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
  ).getDate()
  date.setDate(Math.min(day, daysInMonth))
}

export const nextDueDate = (task: Task): Date | undefined => {
  if (task.repeat === 'No Repeat') return undefined
  const date = newSafeDate(task.due)
  if (task.repeat === 'Daily') date.setDate(date.getDate() + 1)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'day')
    date.setDate(date.getDate() + task.repeatInterval)
  else if (task.repeat === 'Weekly') date.setDate(date.getDate() + 7)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'week') {
    if (!task.repeatWeekdays || !task.repeatWeekdays.some((x) => x))
      date.setDate(date.getDate() + 7 * task.repeatInterval)
    else {
      let i = (date.getDay() + 1) % 7
      while (!task.repeatWeekdays[i]) i = (i + 1) % 7
      if (i > date.getDay()) date.setDate(date.getDate() + i - date.getDay())
      else {
        date.setDate(date.getDate() + 7 * task.repeatInterval)
        date.setDate(date.getDate() + i - date.getDay())
      }
    }
  } else if (task.repeat === 'Weekdays') {
    do {
      date.setDate(date.getDate() + 1)
    } while (date.getDay() === 0 || date.getDay() === 6)
  } else if (task.repeat === 'Monthly') addMonthsClamped(date, 1)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'month')
    addMonthsClamped(date, task.repeatInterval)
  else if (task.repeat === 'Yearly') addMonthsClamped(date, 12)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'year')
    addMonthsClamped(date, 12 * task.repeatInterval)
  // DST safety: shift past 02:00 before round-tripping through dateString +
  // newSafeDate. If the previous arithmetic lands on a spring-forward day,
  // local midnight can be a non-existent instant and JS shifts the Date
  // backward by an hour, which would roll the calendar date back too. The
  // round-trip strips time-of-day, so we only need to be past 02:00 to be
  // safe regardless of timezone.
  date.setHours(date.getHours() + 2)
  return newSafeDate(dateString(date))
}

// Average number of days between occurrences of a repeating task — e.g.
// Weekdays is 7/5 (5 occurrences per 7 days), a Custom M/W/F week is 7/3.
// Returns Infinity for non-repeating tasks so `time / frequency` contributes
// nothing to a per-day workload estimate.
export const repeatFrequencyDays = (
  task: Pick<
    Task,
    'repeat' | 'repeatUnit' | 'repeatInterval' | 'repeatWeekdays'
  >,
): number => {
  switch (task.repeat) {
    case 'No Repeat':
      return Infinity
    case 'Daily':
      return 1
    case 'Weekdays':
      return 7 / 5
    case 'Weekly':
      return 7
    case 'Monthly':
      return 30
    case 'Yearly':
      return 365
    case 'Custom': {
      if (task.repeatUnit === 'day') return task.repeatInterval
      if (task.repeatUnit === 'week') {
        const selected = task.repeatWeekdays.filter((x) => x).length
        return selected > 0
          ? (7 * task.repeatInterval) / selected
          : 7 * task.repeatInterval
      }
      if (task.repeatUnit === 'month') return 30 * task.repeatInterval
      return 365 * task.repeatInterval
    }
  }
}
