import type { HistoryEntry } from '@dtn/shared/schema'

// Per-row progress credit, in minutes. Mirrors the user-facing rule
// "always reward completion" (#9 in the timer design): credit the
// greater of the planned and the actual time. Pre-timer history rows
// have a null actualSeconds — for those we fall back to the snapshot's
// timeFrame so the legacy data still adds up to the old behavior.
export function rowCreditMinutes(row: HistoryEntry): number {
  const plannedMin = row.taskSnapshot?.timeFrame ?? 0
  if (row.actualSeconds === null || row.actualSeconds === undefined) {
    return plannedMin
  }
  const actualMin = row.actualSeconds / 60
  return Math.max(plannedMin, actualMin)
}
