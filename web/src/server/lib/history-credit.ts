import type { HistoryEntry } from '@dtn/shared/schema'

// Per-row credit = ceil(max(planned, actual)). Ceil keeps the aggregate consistent with the rounded timeFrame the frontend sees.
export function rowCreditMinutes(row: HistoryEntry): number {
  const plannedMin = row.taskSnapshot.timeFrame
  if (row.actualSeconds === null) {
    return Math.ceil(plannedMin)
  }
  const actualMin = row.actualSeconds / 60
  return Math.ceil(Math.max(plannedMin, actualMin))
}
