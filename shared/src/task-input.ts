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

// Date is stored / transmitted as YYYY-M-D (no zero padding). Reject any
// other string — in particular the legacy 'No Due Date' sentinel which the
// app no longer supports. The parsed year/month/day must form a real date.
const dueDateSchema = z
  .string()
  .refine(
    (s) => {
      const parts = s.split('-')
      if (parts.length !== 3) return false
      const [y, m, d] = parts.map((p) => parseInt(p))
      if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d))
        return false
      if (y < 1970 || y > 9999) return false
      if (m < 1 || m > 12) return false
      if (d < 1 || d > 31) return false
      return true
    },
    { message: 'Due date must be a valid YYYY-M-D string' },
  )

export const taskInputSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    due: dueDateSchema,
    strictDeadline: z.boolean(),
    repeat: repeatOptionSchema,
    repeatInterval: z.number().int().positive(),
    repeatUnit: repeatUnitSchema,
    repeatWeekdays: repeatWeekdaysSchema,
    timeFrame: z.number().int().nonnegative(),
    subtasks: z.array(subTaskSchema),
  })
  .superRefine((data, ctx) => {
    // Custom weekly without any selected weekdays is ambiguous: the math
    // silently falls through to plain weekly. Force the user to pick at
    // least one day.
    if (
      data.repeat === 'Custom' &&
      data.repeatUnit === 'week' &&
      !data.repeatWeekdays.some((d) => d)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['repeatWeekdays'],
        message: 'Select at least one weekday for a custom weekly repeat.',
      })
    }
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
