import { describe, expect, it } from 'vitest'

import type { Task } from '@dtn/shared/types'
import { tasksToExportJson } from '../export'

const makeTask = (over: Partial<Task> = {}): Task => ({
  id: 'task-1',
  userId: 'user-1',
  title: 'A task',
  emoji: '📝',
  due: '2026-6-1',
  dueTime: null,
  strictDeadline: false,
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
  notes: null,
  tags: [],
  subtasks: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

describe('tasksToExportJson', () => {
  it('produces a JSON array of one entry per task', () => {
    const out = JSON.parse(
      tasksToExportJson([makeTask({ title: 'A' }), makeTask({ title: 'B' })]),
    )
    expect(out).toHaveLength(2)
    expect(out.map((t: { title: string }) => t.title)).toEqual(['A', 'B'])
  })

  it('strips server-only fields so the file is import-safe', () => {
    const [entry] = JSON.parse(
      tasksToExportJson([makeTask({ title: 'Buy milk' })]),
    )
    for (const field of [
      'id',
      'userId',
      'timerStartedAt',
      'timerAccumulatedSeconds',
      'measurementCount',
      'snooze',
      'createdAt',
      'updatedAt',
    ]) {
      expect(entry).not.toHaveProperty(field)
    }
    expect(entry.title).toBe('Buy milk')
    expect(entry).toHaveProperty('repeat')
    expect(entry).toHaveProperty('subtasks')
  })

  it('is empty-array JSON for no tasks', () => {
    expect(JSON.parse(tasksToExportJson([]))).toEqual([])
  })
})
