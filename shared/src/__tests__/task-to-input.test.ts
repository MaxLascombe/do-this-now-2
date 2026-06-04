import { describe, expect, it } from 'vitest'

import { taskToInput } from '../task-input'
import { makeTask } from './_factories'

const INPUT_KEYS = [
  'title',
  'emoji',
  'due',
  'dueTime',
  'strictDeadline',
  'repeat',
  'repeatInterval',
  'repeatUnit',
  'repeatWeekdays',
  'timeFrame',
  'timekeeperId',
  'timeframeType',
  'subtasks',
  'notes',
]

describe('taskToInput', () => {
  it('projects exactly the TaskInput fields', () => {
    expect(Object.keys(taskToInput(makeTask())).sort()).toEqual(
      [...INPUT_KEYS].sort(),
    )
  })

  it('passes editable values through unchanged', () => {
    const task = makeTask({
      title: 'Water plants',
      timeFrame: 42,
      repeat: 'Daily',
      strictDeadline: true,
      dueTime: '09:30',
    })
    const input = taskToInput(task)
    expect(input.title).toBe('Water plants')
    expect(input.timeFrame).toBe(42)
    expect(input.repeat).toBe('Daily')
    expect(input.strictDeadline).toBe(true)
    expect(input.dueTime).toBe('09:30')
  })

  it('drops server-managed fields (id, userId, snooze, timestamps)', () => {
    const input = taskToInput(makeTask()) as Record<string, unknown>
    expect(input.id).toBeUndefined()
    expect(input.userId).toBeUndefined()
    expect(input.snooze).toBeUndefined()
    expect(input.createdAt).toBeUndefined()
    expect(input.updatedAt).toBeUndefined()
  })
})
