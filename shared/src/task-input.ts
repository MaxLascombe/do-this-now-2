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

export const timeframeTypeSchema = z.enum(['fixed', 'fluid'])

// Date is stored / transmitted as YYYY-M-D (no zero padding). Reject any
// other string — in particular the legacy 'No Due Date' sentinel which the
// app no longer supports. The parsed year/month/day must form a real date.
// Exported so REST routes can validate `:date` path params with the same rule.
export const ymdSchema = z
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
    { message: 'Date must be a valid YYYY-M-D string' },
  )

const dueDateSchema = ymdSchema

// 24-hour HH:MM (00:00–23:59). Stored as text so it round-trips with
// HTML <input type="time"> verbatim. Null = no specific time set.
export const dueTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24h)')
  .nullable()

export const taskInputSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    // Single emoji — allow up to 16 chars to accommodate ZWJ sequences and
    // skin-tone modifiers. The form picks from 5 Claude-suggested options.
    emoji: z.string().min(1, 'Emoji is required').max(16),
    due: dueDateSchema,
    dueTime: dueTimeSchema,
    strictDeadline: z.boolean(),
    repeat: repeatOptionSchema,
    repeatInterval: z.number().int().positive(),
    repeatUnit: repeatUnitSchema,
    repeatWeekdays: repeatWeekdaysSchema,
    // Decimal minutes. 0 means "tracked under a timekeeper" — superRefine
    // below requires `timekeeperId` to be set in that case.
    timeFrame: z.number().nonnegative(),
    timekeeperId: z.string().uuid().nullable().default(null),
    timeframeType: timeframeTypeSchema.default('fixed'),
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
    // XOR: either you provide a positive timeFrame OR you nominate a
    // timekeeper that does. The CHECK constraint on the table enforces
    // the same shape at the DB level.
    if (data.timeFrame === 0 && data.timekeeperId === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timekeeperId'],
        message:
          'Tasks with no time frame must be tracked under another task.',
      })
    }
    if (data.timeFrame > 0 && data.timekeeperId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timekeeperId'],
        message:
          'Remove the timekeeper, or set the time frame back to 0.',
      })
    }
  })

export type TaskInput = z.infer<typeof taskInputSchema>
export type RepeatOption = z.infer<typeof repeatOptionSchema>
export type RepeatUnit = z.infer<typeof repeatUnitSchema>
export type RepeatWeekdays = z.infer<typeof repeatWeekdaysSchema>
export type SubTask = z.infer<typeof subTaskSchema>
export type TimeframeType = z.infer<typeof timeframeTypeSchema>

// Project a stored Task back to a TaskInput so callers can update one field
// without losing the rest. Strips server-managed fields (id, userId, snooze,
// timestamps).
export function taskToInput(task: Task): TaskInput {
  return {
    title: task.title,
    emoji: task.emoji,
    due: task.due,
    dueTime: task.dueTime,
    strictDeadline: task.strictDeadline,
    repeat: task.repeat,
    repeatInterval: task.repeatInterval,
    repeatUnit: task.repeatUnit,
    repeatWeekdays: task.repeatWeekdays,
    timeFrame: task.timeFrame,
    timekeeperId: task.timekeeperId,
    timeframeType: task.timeframeType,
    subtasks: task.subtasks,
  }
}
