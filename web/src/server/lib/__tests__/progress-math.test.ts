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
  timeFrame: 60,
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

const inputs = (over: Partial<ProgressInputs> = {}): ProgressInputs => ({
  completedTodayMin: 0,
  streakBeforeToday: 0,
  lives: 0,
  allTasks: [],
  ...over,
})

// All scenarios anchor "today" to the tasks' due date (2026-5-1) so occurrence
// counting starts from day zero, and use May to stay clear of DST transitions.
const today = newSafeDate('2026-5-1')

describe('computeProgress', () => {
  it('spreads a one-off task across the 14-day horizon', () => {
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 100 })
    const { result } = computeProgress(today, inputs({ allTasks: [task] }))
    expect(result.todo).toBe(8) // ceil(100 / 14)
    expect(result.theoreticalMinimum).toBe(0) // non-repeating: no daily minimum
    expect(result.daysUntilAllDone).toBe(14)
    expect(result.minutesToReduceTomorrowDays).toBe(0)
    expect(result.streakIsActive).toBe(false)
  })

  it('counts every occurrence of a daily task in the window', () => {
    const task = makeTask({ repeat: 'Daily', timeFrame: 60 })
    const { result } = computeProgress(today, inputs({ allTasks: [task] }))
    expect(result.todo).toBe(65) // ceil(15 occurrences * 60 / 14)
    expect(result.theoreticalMinimum).toBe(60) // 60 min/day
    expect(result.minutesToReduceTomorrowDays).toBe(60) // also due on the target day
  })

  it('marks the target hit and rolls leftover lives forward', () => {
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 100 })
    const c = computeProgress(
      today,
      inputs({ allTasks: [task], completedTodayMin: 120, streakBeforeToday: 3 }),
    )
    expect(c.result.todo).toBe(16) // ceil((100 + 120) / 14)
    expect(c.result.streakIsActive).toBe(true)
    expect(c.result.streak).toBe(4)
    expect(c.rolloverLives).toBe(104) // 120 - 16
    expect(c.rolloverStreak).toBe(4)
  })

  it('counts banked lives toward the day target', () => {
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 100 })
    const c = computeProgress(
      today,
      inputs({ allTasks: [task], completedTodayMin: 4, lives: 10 }),
    )
    expect(c.result.todo).toBe(8) // ceil((100 + 4) / 14)
    expect(c.result.streakIsActive).toBe(true) // 4 done + 10 lives >= 8
    expect(c.rolloverLives).toBe(6) // 4 + 10 - 8
  })

  it('reports an empty day with no tasks', () => {
    const { result } = computeProgress(today, inputs())
    expect(result.todo).toBe(0)
    expect(result.daysUntilAllDone).toBe(14)
    expect(result.streakIsActive).toBe(true) // 0 done >= 0 todo
  })
})
