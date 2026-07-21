import { MINUTES_IN_DAY, minutesToHours } from './time'
import type { RecapDay } from './types'

// The one fill model behind every Progress Bar rendering (desktop blocks,
// popover, web-mobile strip/sheet, RN mini bar/sheet). Done Minutes fill from
// the start; banked Lives extend the fill beyond them in a distinct color; a
// full bar always means the day is won (done + lives >= todo) and is never
// shown full before then — rounding must not fake a win.

export type ProgressCellFill = 'done' | 'lives' | 'empty'

export type ProgressCell = {
  key: number
  fill: ProgressCellFill
  isTick: boolean
}

export type BarSplit = { doneUnits: number; livesUnits: number }

// Split `count` units of a Daily-Target-length bar between done-colored and
// Lives-colored fill. Works for cells (count = 24) and percent strips
// (count = 100) alike.
export function splitBarUnits(opts: {
  done: number
  lives: number
  todo: number
  count: number
}): BarSplit {
  const { done, lives, todo, count } = opts
  if (todo <= 0) return { doneUnits: 0, livesUnits: 0 }
  if (done >= todo) return { doneUnits: count, livesUnits: 0 }
  const won = done + lives >= todo
  const total = won
    ? count
    : Math.min(count - 1, Math.round(((done + lives) / todo) * count))
  const doneUnits = Math.min(
    Math.round((done / todo) * count),
    won ? count - 1 : total,
  )
  return { doneUnits, livesUnits: Math.max(0, total - doneUnits) }
}

// Cell list with the Pacing Tick at `shouldBeDone`. The tick outline shows
// whether or not its cell is filled, so the marker stays visible when ahead.
export function progressCells(opts: {
  count: number
  done: number
  lives: number
  todo: number
  shouldBeDone: number
}): ProgressCell[] {
  const { count, done, lives, todo, shouldBeDone } = opts
  const { doneUnits, livesUnits } = splitBarUnits({ done, lives, todo, count })
  const tickAt = todo > 0 ? Math.round((shouldBeDone / todo) * count) : 0
  return Array.from({ length: count }, (_, i) => ({
    key: i,
    fill:
      i < doneUnits
        ? ('done' as const)
        : i < doneUnits + livesUnits
          ? ('lives' as const)
          : ('empty' as const),
    isTick: i === tickAt - 1,
  }))
}

// A Won Day the moment it happens: done + Lives covering the Daily Target.
// todo must be positive — a no-tasks day is trivially "won" but never worth
// celebrating.
export const isDayWon = (p: {
  done: number
  lives: number
  todo: number
}): boolean => p.todo > 0 && p.done + p.lives >= p.todo

export const STREAK_MILESTONES = [7, 30, 100, 365] as const

export const streakMilestone = (streak: number): number | null =>
  (STREAK_MILESTONES as readonly number[]).includes(streak) ? streak : null

// One Recap line, equal weight for wins and losses — losses stated honestly
// ("bank 3h wiped · streak 12 → 0"), never softened. Titles (Yesterday /
// dates) are the caller's job.
export function describeRecapDay(day: RecapDay): {
  headline: 'Won' | 'Lost'
  detail: string
} {
  const doneLabel = `${minutesToHours(day.done)} done`
  if (day.won) {
    const delta = day.livesAfter - day.livesBefore
    const livesPart =
      delta >= 0
        ? `+${minutesToHours(delta)} banked`
        : `won on ${minutesToHours(-delta)} of Lives`
    return {
      headline: 'Won',
      detail: `${doneLabel} · ${livesPart} · streak ${day.streakAfter}`,
    }
  }
  const wipe =
    day.livesBefore > 0 ? `bank ${minutesToHours(day.livesBefore)} wiped · ` : ''
  return {
    headline: 'Lost',
    detail: `${doneLabel} · ${wipe}streak ${day.streakBefore} → 0`,
  }
}

export type WinEta = { kind: 'won' } | { kind: 'eta'; minutesOfDay: number }

// Projected clock time at which done + lives reaches the Daily Target, from
// the completion-credited pace so far today. Before any completion (or before
// the workday) it falls back to the tick pace. Running timers deliberately
// contribute nothing — projections may estimate, the scoreboard only records.
export function computeWinEta(opts: {
  now: Date
  done: number
  lives: number
  todo: number
  workdayStartMin: number
  workdayEndMin: number
}): WinEta {
  const { now, done, lives, todo, workdayStartMin, workdayEndMin } = opts
  const remaining = todo - done - lives
  if (todo <= 0 || remaining <= 0) return { kind: 'won' }
  const timeOfDay = now.getHours() * 60 + now.getMinutes()
  const elapsed = timeOfDay - workdayStartMin
  const tickPace = todo / Math.max(1, workdayEndMin - workdayStartMin)
  const pace = done > 0 && elapsed > 0 ? done / elapsed : tickPace
  const base = Math.max(timeOfDay, workdayStartMin)
  return { kind: 'eta', minutesOfDay: Math.round(base + remaining / pace) }
}

export const formatWinEta = (eta: WinEta): string => {
  if (eta.kind === 'won') return 'won'
  if (eta.minutesOfDay >= MINUTES_IN_DAY) return '>24:00'
  const h = Math.floor(eta.minutesOfDay / 60)
  const m = eta.minutesOfDay % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
