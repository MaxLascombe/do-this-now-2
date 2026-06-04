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

  describe('notes', () => {
    it('defaults to null when omitted', () => {
      const r = taskInputSchema.safeParse(base)
      expect(r.success && r.data.notes).toBe(null)
    })

    it('normalizes blank/whitespace notes to null', () => {
      for (const notes of ['', '   ', '\n\t']) {
        const r = taskInputSchema.safeParse({ ...base, notes })
        expect(r.success && r.data.notes).toBe(null)
      }
    })

    it('keeps real notes content', () => {
      const r = taskInputSchema.safeParse({ ...base, notes: 'see the doc' })
      expect(r.success && r.data.notes).toBe('see the doc')
    })

    it('rejects notes over the length cap', () => {
      expect(
        taskInputSchema.safeParse({ ...base, notes: 'x'.repeat(5001) }).success,
      ).toBe(false)
    })
  })

  describe('tags', () => {
    it('defaults to an empty array when omitted', () => {
      const r = taskInputSchema.safeParse(base)
      expect(r.success && r.data.tags).toEqual([])
    })

    it('trims, drops blanks, and dedupes case-insensitively', () => {
      const r = taskInputSchema.safeParse({
        ...base,
        tags: ['  work ', 'Work', '', 'home', 'home'],
      })
      expect(r.success && r.data.tags).toEqual(['work', 'home'])
    })

    it('rejects too many tags', () => {
      expect(
        taskInputSchema.safeParse({
          ...base,
          tags: Array.from({ length: 21 }, (_, i) => `t${i}`),
        }).success,
      ).toBe(false)
    })
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
