import type { HistoryEntry } from '@dtn/shared/schema'

// Per-row credit = ceil(max(planned, actual)). Ceil keeps the aggregate consistent with the rounded timeFrame the frontend sees.
export function rowCreditMinutes(row: HistoryEntry): number {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- snapshots predate this column; may be undefined at runtime
  const plannedMin = row.taskSnapshot.timeFrame ?? 0
  if (row.actualSeconds === null) {
    return Math.ceil(plannedMin)
  }
  const actualMin = row.actualSeconds / 60
  return Math.ceil(Math.max(plannedMin, actualMin))
}
