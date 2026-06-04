import { newSafeDate } from '@dtn/shared/helpers'
import { type Task } from '@dtn/shared/schema'
import { describe, expect, it } from 'vitest'

import { computeProgress, type ProgressInputs } from '../progress-math'

const makeTask = (over: Partial<Task> = {}): Task => ({
  id: 'task-test',
  userId: 'user-test',
  title: 'A task',
  emoji: '📝',
  due: '2026-5-1',
  dueTime: null,
  strictDeadline: false,
  repeat: 'No Repeat',
  repeatInterval: 1,
  repeatUnit: 'day',
  repeatWeekdays: [false, false, false, false, false, false, false],
  timeFrame: 70,
  timekeeperId: null,
  timeframeType: 'fixed',
  timerStartedAt: null,
  timerAccumulatedSeconds: 0,
  measurementCount: 0,
  snooze: null,
  subtasks: [],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...over,
})

const inputs = (allTasks: Array<Task>): ProgressInputs => ({
  completedTodayMin: 0,
  streakBeforeToday: 0,
  lives: 0,
  allTasks,
})

const today = newSafeDate('2026-5-1')

// theoreticalMinimum accrues time / repeatFrequencyDays per repeating task.
// The main suite only covers a daily task (frequency 1, no division); these
// exercise non-unit frequencies so the division is actually verified.
describe('computeProgress theoreticalMinimum by repeat frequency', () => {
  it('divides a weekly task by 7', () => {
    const { result } = computeProgress(
      today,
      inputs([makeTask({ repeat: 'Weekly' })]),
    )
    expect(result.theoreticalMinimum).toBe(10) // ceil(70 / 7)
  })

  it('divides an every-2-weeks custom task by 14', () => {
    const { result } = computeProgress(
      today,
      inputs([
        makeTask({ repeat: 'Custom', repeatUnit: 'week', repeatInterval: 2 }),
      ]),
    )
    expect(result.theoreticalMinimum).toBe(5) // ceil(70 / 14)
  })
})
