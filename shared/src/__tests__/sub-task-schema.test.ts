import { describe, expect, it } from 'vitest'

import { subTaskSchema } from '../task-input'

describe('subTaskSchema snooze normalization', () => {
  it('keeps a snooze timestamp string', () => {
    const r = subTaskSchema.parse({
      title: 'a',
      done: false,
      snooze: '2026-05-01T12:00:00Z',
    })
    expect(r.snooze).toBe('2026-05-01T12:00:00Z')
  })

  it('normalizes a null snooze (from the DB jsonb column) to undefined', () => {
    const r = subTaskSchema.parse({ title: 'a', done: false, snooze: null })
    expect(r.snooze).toBeUndefined()
  })

  it('treats a missing snooze as undefined', () => {
    expect(subTaskSchema.parse({ title: 'a', done: true }).snooze).toBeUndefined()
  })

  it('rejects a non-string, non-null snooze', () => {
    expect(
      subTaskSchema.safeParse({ title: 'a', done: false, snooze: 123 }).success,
    ).toBe(false)
  })
})
