import type { HistoryEntry } from '@dtn/shared/schema'
import { ceilMinutes } from '@dtn/shared/time'

// Per-row credit = ceil(max(planned, actual)). Ceil keeps the aggregate consistent with the rounded timeFrame the frontend sees.
export function rowCreditMinutes(row: HistoryEntry): number {
  const plannedMin = row.taskSnapshot?.timeFrame ?? 0
  if (row.actualSeconds === null || row.actualSeconds === undefined) {
    return ceilMinutes(plannedMin)
  }
  const actualMin = row.actualSeconds / 60
  return ceilMinutes(Math.max(plannedMin, actualMin))
}
