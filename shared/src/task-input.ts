import { z } from 'zod'

import type { Task } from './types'

export const subTaskSchema = z.object({
  title: z.string(),
  done: z.boolean(),
  // Accept null from the DB (jsonb column) and normalize to undefined.
  snooze: z.preprocess(
    (v) => (v === null ? undefined : v),
    z.string().optional(),
  ),
})

export const repeatWeekdaysSchema = z.tuple([
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
  z.boolean(),
])

export const repeatOptionSchema = z.enum([
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
])

export const repeatUnitSchema = z.enum(['day', 'week', 'month', 'year'])

export const taskInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  due: z.string(),
  strictDeadline: z.boolean(),
  repeat: repeatOptionSchema,
  repeatInterval: z.number().int().positive(),
  repeatUnit: repeatUnitSchema,
  repeatWeekdays: repeatWeekdaysSchema,
  timeFrame: z.number().int().nonnegative(),
  subtasks: z.array(subTaskSchema),
})

export type TaskInput = z.infer<typeof taskInputSchema>
export type RepeatOption = z.infer<typeof repeatOptionSchema>
export type RepeatUnit = z.infer<typeof repeatUnitSchema>
export type RepeatWeekdays = z.infer<typeof repeatWeekdaysSchema>
export type SubTask = z.infer<typeof subTaskSchema>

// Project a stored Task back to a TaskInput so callers can update one field
// without losing the rest. Strips server-managed fields (id, userId, snooze,
// timestamps).
export function taskToInput(task: Task): TaskInput {
  return {
    title: task.title,
    due: task.due,
    strictDeadline: task.strictDeadline,
    repeat: task.repeat,
    repeatInterval: task.repeatInterval,
    repeatUnit: task.repeatUnit,
    repeatWeekdays: task.repeatWeekdays,
    timeFrame: task.timeFrame,
    subtasks: task.subtasks,
  }
}
