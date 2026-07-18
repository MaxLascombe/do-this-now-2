import type { HistoryEntry, Task } from '@dtn/shared/schema'
import { describe, expect, it } from 'vitest'

import { rowCreditMinutes } from '../history-credit'

const baseTask: Task = {
  id: 'task-1',
  userId: 'user-1',
  title: 'A task',
  emoji: '📝',
  due: '2026-5-1',
  dueTime: null,
  strictDeadline: false,
  canDoEarly: true,
  repeat: 'No Repeat',
  repeatInterval: 1,
  repeatUnit: 'day',
  repeatWeekdays: [false, false, false, false, false, false, false],
  timeFrame: 0,
  timekeeperId: null,
  timeframeType: 'fixed',
  timerStartedAt: null,
  timerAccumulatedSeconds: 0,
  measurementCount: 0,
  snooze: null,
  tags: [],
  subtasks: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
}

const makeRow = (
  timeFrame: number,
  actualSeconds: number | null,
): HistoryEntry => ({
  id: 'row-1',
  userId: 'user-1',
  taskId: 'task-1',
  taskSnapshot: { ...baseTask, timeFrame },
  actualSeconds,
  completedAt: new Date('2026-05-01T12:00:00Z'),
})

describe('rowCreditMinutes', () => {
  it('falls back to the planned timeFrame when actualSeconds is null', () => {
    expect(rowCreditMinutes(makeRow(30, null))).toBe(30)
    expect(rowCreditMinutes(makeRow(30.4, null))).toBe(31) // ceil
  })

  it('credits the actual time when it exceeds the plan', () => {
    expect(rowCreditMinutes(makeRow(30, 40 * 60))).toBe(40)
    expect(rowCreditMinutes(makeRow(30, 30 * 60 + 1))).toBe(31) // ceil
  })

  it('credits the plan when it exceeds the actual (undershoot)', () => {
    expect(rowCreditMinutes(makeRow(60, 10 * 60))).toBe(60)
  })

  it('handles a zero-time-frame child completed with no timer', () => {
    expect(rowCreditMinutes(makeRow(0, 0))).toBe(0)
  })
})
