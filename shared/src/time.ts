export const minutesToHours = (minutes: number): string => {
  const twoDigit = (n: number) => (n < 10 ? '0' : '') + n
  const hours = Math.floor(minutes / 60)
  const minutesLeft = minutes % 60
  return `${hours}h${minutesLeft > 0 ? twoDigit(minutesLeft) : ''}`
}

export const getTzOffsetMin = (): number => new Date().getTimezoneOffset()

// Day-of-the-day-bar starting point used by Progress to compute "where in
// the day are we" for the ahead/behind-schedule indicator. 8:30am local.
export const START_OF_DAY_MINUTES = 8 * 60 + 30
export const MINUTES_IN_DAY = 24 * 60

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

export const ceilMinutes = (m: number): number => Math.ceil(m)
