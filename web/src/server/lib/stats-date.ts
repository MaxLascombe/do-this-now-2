// Pure user-local date/time projections for a UTC instant given the client's
// TZ offset (minutes west of UTC, matching Date.prototype.getTimezoneOffset()).
// Kept free of DB/request access so the timezone math is unit-testable.

// User-local YYYY-M-D key. Matches the shape produced by `dateString` in
// @dtn/shared/helpers — no zero padding.
export function localDateKey(utcMs: number, tzOffsetMin: number): string {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth() + 1
  const d = shifted.getUTCDate()
  return `${y}-${m}-${d}`
}

// User-local hour-of-day (0..23) for a UTC instant.
export function localHour(utcMs: number, tzOffsetMin: number): number {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  return shifted.getUTCHours()
}

// User-local day-of-week (0=Sun .. 6=Sat) for a UTC instant.
export function localDayOfWeek(utcMs: number, tzOffsetMin: number): number {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  return shifted.getUTCDay()
}
