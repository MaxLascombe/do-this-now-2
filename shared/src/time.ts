export const minutesToHours = (minutes: number): string => {
  const twoDigit = (n: number) => (n < 10 ? '0' : '') + n
  // fluid timeFrames carry EMA decimals — round before splitting
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const minutesLeft = rounded % 60
  return `${hours}h${minutesLeft > 0 ? twoDigit(minutesLeft) : ''}`
}

export const getTzOffsetMin = (): number => new Date().getTimezoneOffset()

// Default Workday start (8:30am local). The live value is a user setting
// (see ./settings DEFAULT_SETTINGS); this constant only seeds the default.
export const START_OF_DAY_MINUTES = 8 * 60 + 30
export const MINUTES_IN_DAY = 24 * 60

export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS
