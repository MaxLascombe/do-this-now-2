import { describe, expect, it } from 'vitest'

import { heatmapCellPosition } from '../heatmap'

// Latest day = last index; with todayDow = 3 (Wed) it sits in the last column.
describe('heatmapCellPosition', () => {
  it('places the latest day in the last column on its weekday row', () => {
    expect(heatmapCellPosition(9, 10, 3, 26)).toEqual({ col: 25, row: 3 })
  })

  it('steps earlier days back one row, then wraps a column at the week edge', () => {
    expect(heatmapCellPosition(8, 10, 3, 26)).toEqual({ col: 25, row: 2 })
    // 3 days before Wed lands on Sun (row 0) — still this week's column.
    expect(heatmapCellPosition(6, 10, 3, 26)).toEqual({ col: 25, row: 0 })
    // 4 days before wraps to Saturday (row 6) of the previous column.
    expect(heatmapCellPosition(5, 10, 3, 26)).toEqual({ col: 24, row: 6 })
  })

  it('returns a negative column for days older than the rendered window', () => {
    expect(heatmapCellPosition(0, 200, 3, 26).col).toBeLessThan(0)
  })
})
