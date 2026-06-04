// Value at the p-th percentile of an ascending-sorted array (0 for empty).
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(((sorted.length - 1) * p) / 100),
  )
  return sorted[idx]
}

// A bar-chart axis maximum that ignores extreme high outliers, so one giant
// spike doesn't crush every other bar to a sliver. Scales by the largest value
// within the Tukey upper fence (Q3 + 1.5·IQR) of the non-zero counts; spikes
// above it are meant to clamp to full height at the call site. Returns 1 for an
// all-zero series so callers can divide safely.
export function robustChartMax(values: number[]): number {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (nonZero.length === 0) return 1
  const q1 = percentile(nonZero, 25)
  const q3 = percentile(nonZero, 75)
  const fence = q3 + 1.5 * (q3 - q1)
  const withinFence = nonZero.filter((v) => v <= fence)
  return withinFence.length > 0 ? withinFence[withinFence.length - 1] : nonZero[nonZero.length - 1]
}

// Grid position for the `index`-th day in an oldest-first heatmap series:
// the latest day sits in the last column on its weekday row, and earlier days
// step back through the weeks. `col` may be negative when a day predates the
// leftmost rendered column — callers clip it.
export function heatmapCellPosition(
  index: number,
  total: number,
  todayDow: number,
  numCols: number,
): { col: number; row: number } {
  const dowOffset = todayDow - (total - 1 - index)
  const colsBack = Math.ceil(-dowOffset / 7)
  return {
    col: numCols - 1 - colsBack,
    row: ((dowOffset % 7) + 7) % 7,
  }
}

// Heatmap cell color: empty days are faint, target-hit and top-tier days are
// the accent, with two mid tiers above the p33/p66 thresholds.
export function heatmapColor(
  minutes: number,
  hit: boolean,
  p33: number,
  p66: number,
): string {
  if (minutes === 0) return 'rgba(255,255,255,0.04)'
  if (hit || minutes >= p66) return '#34d399'
  if (minutes >= p33) return '#059669'
  return '#065f46'
}
