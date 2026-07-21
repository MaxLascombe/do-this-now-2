export type Schedule = {
  shouldBeDone: number
  isBeforeWorkday: boolean
}

// How many minutes "should" be done by `now`, pacing the Daily Target
// linearly across the Workday (clamped to that window). Paces toward the
// target only — never past the bar — and compares real work alone; Lives
// never count as pace.
export function computeSchedule(
  now: Date,
  todo: number,
  workdayStartMin: number,
  workdayEndMin: number,
): Schedule {
  const timeOfDay = now.getHours() * 60 + now.getMinutes()
  const workdayLen = Math.max(1, workdayEndMin - workdayStartMin)
  const pctOfDay = Math.max(
    0,
    Math.min(1, (timeOfDay - workdayStartMin) / workdayLen),
  )
  return {
    shouldBeDone: todo * pctOfDay,
    isBeforeWorkday: timeOfDay < workdayStartMin,
  }
}
