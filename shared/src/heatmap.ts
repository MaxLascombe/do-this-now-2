// Value at the p-th percentile of an ascending-sorted array (0 for empty).
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(((sorted.length - 1) * p) / 100),
  )
  return sorted[idx]
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
