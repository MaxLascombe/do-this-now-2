import type { RepeatOption, RepeatUnit, RepeatWeekdays } from './task-input'

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
    const base =
      repeatInterval > 1
        ? `${repeatInterval} ${repeatUnit}s`
        : `${repeatUnit}ly`
    return (base + suffix).toLowerCase()
  }

  return repeat.toLowerCase()
}
