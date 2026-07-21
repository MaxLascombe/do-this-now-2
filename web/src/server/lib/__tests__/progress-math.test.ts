import { newSafeDate } from '@dtn/shared/helpers'
import { type Task } from '@dtn/shared/schema'
import { DEFAULT_SETTINGS } from '@dtn/shared/settings'
import { describe, expect, it } from 'vitest'

import {
  buildRecap,
  computeProgress,
  findMinutesOnTargetDay,
  settleChain,
  type ProgressInputs,
} from '../progress-math'

const makeTask = (over: Partial<Task> = {}): Task => ({
  id: 'task-test',
  userId: 'user-test',
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
  timeFrame: 60,
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
  ...over,
})

const inputs = (over: Partial<ProgressInputs> = {}): ProgressInputs => ({
  completedTodayMin: 0,
  streakBeforeToday: 0,
  lives: 0,
  bestStreakBefore: 0,
  allTasks: [],
  settings: DEFAULT_SETTINGS,
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

  it('echoes the workday settings and tracks the best streak', () => {
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 100 })
    const c = computeProgress(
      today,
      inputs({
        allTasks: [task],
        completedTodayMin: 120,
        streakBeforeToday: 3,
        bestStreakBefore: 10,
      }),
    )
    expect(c.result.workdayStartMin).toBe(DEFAULT_SETTINGS.workdayStartMin)
    expect(c.result.workdayEndMin).toBe(DEFAULT_SETTINGS.workdayEndMin)
    expect(c.result.bestStreak).toBe(10) // past best still ahead of streak 4
  })

  it('caps the target at the workday length, not a fixed constant', () => {
    // raw ceil(10000 / 14) = 715 far exceeds the 4h (240-min) workday
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 10000 })
    const { result } = computeProgress(
      today,
      inputs({
        allTasks: [task],
        settings: {
          workdayStartMin: 8 * 60,
          workdayEndMin: 12 * 60,
          horizonDays: 14,
        },
      }),
    )
    expect(result.todo).toBe(240) // capped at the 4h workday
  })

  it('shrinks the horizon the target averages over', () => {
    const task = makeTask({ repeat: 'No Repeat', timeFrame: 100 })
    const { result } = computeProgress(
      today,
      inputs({
        allTasks: [task],
        settings: { ...DEFAULT_SETTINGS, horizonDays: 7 },
      }),
    )
    expect(result.todo).toBe(15) // ceil(100 / 7)
  })
})

describe('buildRecap', () => {
  const row = (date: string, streakBeforeToday: number, lives: number) => ({
    date,
    streakBeforeToday,
    lives,
  })

  it('reads a won day from its next-day rollover row', () => {
    // today 5-3; day 5-2 verdict lives in the 5-3 row
    const days = buildRecap(
      newSafeDate('2026-5-3'),
      [row('2026-5-2', 4, 30), row('2026-5-3', 5, 45)],
      new Map([['2026-5-2', 75]]),
      14,
    )
    expect(days[0]).toEqual({
      date: '2026-5-2',
      won: true,
      done: 75,
      livesBefore: 30,
      livesAfter: 45,
      streakBefore: 4,
      streakAfter: 5,
    })
  })

  it('reads a lost day from a {0,0} settlement row', () => {
    const days = buildRecap(
      newSafeDate('2026-5-3'),
      [row('2026-5-2', 9, 120), row('2026-5-3', 0, 0)],
      new Map([['2026-5-2', 40]]),
      14,
    )
    expect(days[0]).toEqual({
      date: '2026-5-2',
      won: false,
      done: 40,
      livesBefore: 120,
      livesAfter: 0,
      streakBefore: 9,
      streakAfter: 0,
    })
  })

  it('skips days with no next-day row (unsettled / pre-feature)', () => {
    const days = buildRecap(
      newSafeDate('2026-5-10'),
      [row('2026-5-3', 2, 10)], // only day 5-2's verdict exists
      new Map(),
      14,
    )
    expect(days.map((d) => d.date)).toEqual(['2026-5-2'])
  })
})

describe('settleChain', () => {
  it('banks the surplus and extends the streak on a won day', () => {
    const rows = settleChain({ streakBeforeToday: 3, lives: 20 }, [
      { done: 100, todo: 60 },
    ])
    expect(rows).toEqual([{ streakBeforeToday: 4, lives: 60 }])
  })

  it('lets the bank alone win absent days until it runs dry', () => {
    // 130 lives vs three 60-min targets: two rest days won, then a wipe.
    const rows = settleChain({ streakBeforeToday: 5, lives: 130 }, [
      { done: 0, todo: 60 },
      { done: 0, todo: 60 },
      { done: 0, todo: 60 },
    ])
    expect(rows).toEqual([
      { streakBeforeToday: 6, lives: 70 },
      { streakBeforeToday: 7, lives: 10 },
      { streakBeforeToday: 0, lives: 0 },
    ])
  })

  it('wipes everything on a loss — done minutes carry nothing', () => {
    const rows = settleChain({ streakBeforeToday: 9, lives: 30 }, [
      { done: 400, todo: 500 },
    ])
    expect(rows).toEqual([{ streakBeforeToday: 0, lives: 0 }])
  })

  it('can rebuild a streak after a mid-gap wipe', () => {
    const rows = settleChain({ streakBeforeToday: 2, lives: 0 }, [
      { done: 10, todo: 60 }, // loss
      { done: 80, todo: 60 }, // win from zero
    ])
    expect(rows).toEqual([
      { streakBeforeToday: 0, lives: 0 },
      { streakBeforeToday: 1, lives: 20 },
    ])
  })
})

describe('findMinutesOnTargetDay', () => {
  // today is a Friday; target = today + daysUntilAllDone + 1.
  const friday = newSafeDate('2026-5-1')

  it('counts a daily task on the target day', () => {
    const t = makeTask({ repeat: 'Daily', timeFrame: 30 })
    expect(findMinutesOnTargetDay(friday, [t], 0)).toBe(30) // target 5-2
  })

  it('counts a weekly task when the target lands on its weekday', () => {
    const t = makeTask({ repeat: 'Weekly', due: '2026-5-1', timeFrame: 60 })
    expect(findMinutesOnTargetDay(friday, [t], 6)).toBe(60) // target 5-8 (Fri)
  })

  it('respects repeatInterval for custom-week repeats', () => {
    // Every 2 weeks from Fri 5-1: due 5-15, not 5-8.
    const t = makeTask({
      repeat: 'Custom',
      repeatUnit: 'week',
      repeatInterval: 2,
      due: '2026-5-1',
      timeFrame: 100,
    })
    expect(findMinutesOnTargetDay(friday, [t], 6)).toBe(0) // target 5-8: off-cycle
    expect(findMinutesOnTargetDay(friday, [t], 13)).toBe(100) // target 5-15: on-cycle
  })

  it('counts a one-shot task only on its exact due day', () => {
    const t = makeTask({ repeat: 'No Repeat', due: '2026-5-5', timeFrame: 50 })
    expect(findMinutesOnTargetDay(friday, [t], 3)).toBe(50) // target 5-5
    expect(findMinutesOnTargetDay(friday, [t], 0)).toBe(0) // target 5-2
  })
})
