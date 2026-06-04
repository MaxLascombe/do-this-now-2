import { DAY_MS } from './time'

const atMidnight = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const startOfToday = (): Date => atMidnight(new Date())

// Calendar days from `now` to `d`: 0 = today, 1 = tomorrow, negative = overdue.
export const dayIndex = (d: Date, now: Date = new Date()): number =>
  Math.round((atMidnight(d).getTime() - atMidnight(now).getTime()) / DAY_MS)
