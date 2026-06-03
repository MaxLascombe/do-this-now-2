import { describe, expect, it } from 'vitest'

import { taskInputSchema } from '../task-input'

const UUID = '00000000-0000-0000-0000-000000000000'

const base = {
  title: 'A task',
  emoji: '📝',
  due: '2026-5-1',
  dueTime: null,
  strictDeadline: false,
  repeat: 'No Repeat' as const,
  repeatInterval: 1,
  repeatUnit: 'day' as const,
  repeatWeekdays: [false, false, false, false, false, false, false],
  timeFrame: 30,
  timekeeperId: null,
  timeframeType: 'fixed' as const,
  subtasks: [],
}

describe('taskInputSchema', () => {
  it('accepts a valid fixed-time-frame task', () => {
    expect(taskInputSchema.safeParse(base).success).toBe(true)
  })

  it('requires a non-empty title and a sane emoji', () => {
    expect(taskInputSchema.safeParse({ ...base, title: '' }).success).toBe(false)
    expect(
      taskInputSchema.safeParse({ ...base, emoji: 'x'.repeat(17) }).success,
    ).toBe(false)
  })

  it('requires a positive integer repeatInterval', () => {
    expect(
      taskInputSchema.safeParse({ ...base, repeatInterval: 0 }).success,
    ).toBe(false)
    expect(
      taskInputSchema.safeParse({ ...base, repeatInterval: 1.5 }).success,
    ).toBe(false)
  })

  describe('timeFrame / timekeeper XOR', () => {
    it('rejects no time frame and no timekeeper', () => {
      expect(
        taskInputSchema.safeParse({
          ...base,
          timeFrame: 0,
          timekeeperId: null,
        }).success,
      ).toBe(false)
    })

    it('accepts no time frame tracked under a timekeeper', () => {
      expect(
        taskInputSchema.safeParse({
          ...base,
          timeFrame: 0,
          timekeeperId: UUID,
        }).success,
      ).toBe(true)
    })

    it('rejects a positive time frame that also names a timekeeper', () => {
      expect(
        taskInputSchema.safeParse({
          ...base,
          timeFrame: 30,
          timekeeperId: UUID,
        }).success,
      ).toBe(false)
    })
  })
})
