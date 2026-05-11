import type { Task } from './types'

export const newSafeDate = (str: string): Date => {
  const [year, month, day] = str.split('-').map((s) => parseInt(s))
  return new Date(year, month - 1, day)
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
    const daysToAdd = date.getDay() === 5 ? 3 : 1
    date.setDate(date.getDate() + daysToAdd)
  } else if (task.repeat === 'Monthly') date.setMonth(date.getMonth() + 1)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'month')
    date.setMonth(date.getMonth() + task.repeatInterval)
  else if (task.repeat === 'Yearly') date.setFullYear(date.getFullYear() + 1)
  else if (task.repeat === 'Custom' && task.repeatUnit === 'year')
    date.setFullYear(date.getFullYear() + task.repeatInterval)
  // DST safety: shift past 02:00 before round-tripping through dateString +
  // newSafeDate. If the previous arithmetic lands on a spring-forward day,
  // local midnight can be a non-existent instant and JS shifts the Date
  // backward by an hour, which would roll the calendar date back too. The
  // round-trip strips time-of-day, so we only need to be past 02:00 to be
  // safe regardless of timezone.
  date.setHours(date.getHours() + 2)
  return newSafeDate(dateString(date))
}
