import { format } from 'date-fns'

import { newSafeDate } from './helpers'
import type { RepeatOption, RepeatUnit, RepeatWeekdays } from './task-input'
import { minutesToHours } from './time'

const WEEKDAY_SHORT = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'] as const

/**
 * Human-readable label for a task's repeat config. Returns null when the
 * task does not repeat, so callers can skip rendering entirely.
 *
 *   'No Repeat'              → null
 *   'Daily' / 'Weekly' / ... → 'daily', 'weekly', ...
 *   'Custom' every 1 day     → 'daily'
 *   'Custom' every 3 weeks   → '3 weeks'
 *   'Custom' weekly on M/W/F → 'weekly: mo, we, fr'
 */
export function formatRepeat(
  repeat: RepeatOption | string,
  repeatInterval: number,
  repeatUnit: RepeatUnit | string,
  repeatWeekdays: readonly boolean[] | RepeatWeekdays,
): string | null {
  if (repeat === 'No Repeat') return null

  if (repeat === 'Custom') {
    let suffix = ''
    if (repeatUnit === 'week' && repeatWeekdays.some((x) => x)) {
      suffix =
        ': ' +
        repeatWeekdays
          .map((x, i) => (x ? WEEKDAY_SHORT[i] : ''))
          .filter((x) => x)
          .join(', ')
    }
    const singular = repeatUnit === 'day' ? 'daily' : `${repeatUnit}ly`
    const base =
      repeatInterval > 1 ? `${repeatInterval} ${repeatUnit}s` : singular
    return (base + suffix).toLowerCase()
  }

  return repeat.toLowerCase()
}

/**
 * Status text for the progress bar:
 *   - before 8:30am with nothing done → 'Ahead of schedule' (the workday
 *     hasn't started; "on schedule" misreads as neutral when it should be
 *     positive)
 *   - done > shouldBeDone → 'Xh Ym ahead of schedule'
 *   - done < shouldBeDone → 'Xh Ym behind schedule'
 *   - exact tie during the workday → 'On schedule'
 */
export function formatScheduleStatus(opts: {
  done: number
  shouldBeDone: number
  isBeforeWorkday: boolean
  /** Drop the trailing " of schedule" for tight spaces (e.g. a status pill). */
  short?: boolean
}): string {
  const { done, shouldBeDone, isBeforeWorkday, short } = opts
  const diff = done - shouldBeDone
  const suffix = short ? '' : ' of schedule'
  if (isBeforeWorkday && diff === 0) return short ? 'Ahead' : 'Ahead of schedule'
  if (diff > 0) return `${minutesToHours(Math.floor(diff))} ahead${suffix}`
  if (diff < 0) return `${minutesToHours(Math.ceil(-diff))} behind${suffix}`
  return 'On schedule'
}

/**
 * Human-readable label for a task's due date. Returns null if `due` can't
 * be parsed (shouldn't happen — schema enforces YYYY-M-D, but the History
 * page renders archived snapshots that may predate the constraint).
 *
 *   today    → 'Today'
 *   today+1  → 'Tomorrow'
 *   today-1  → 'Yesterday'
 *   other    → 'Wed Mar 5' (date-fns `iii LLL d`)
 */
export function formatDueLabel(due: string): string | null {
  try {
    const dueDate = newSafeDate(due)
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    const t = dueDate.getTime()
    if (t === today.getTime()) return 'Today'
    if (t === today.getTime() + 24 * 60 * 60 * 1000) return 'Tomorrow'
    if (t === today.getTime() - 24 * 60 * 60 * 1000) return 'Yesterday'
    return format(dueDate, 'iii LLL d')
  } catch {
    return null
  }
}
