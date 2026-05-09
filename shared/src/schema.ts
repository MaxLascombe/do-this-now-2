import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const repeatOptionEnum = pgEnum('repeat_option', [
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
])

export const repeatUnitEnum = pgEnum('repeat_unit', [
  'day',
  'week',
  'month',
  'year',
])

export type SubTask = { title: string; done: boolean; snooze?: string }

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  due: text('due').notNull().default('No Due Date'),
  strictDeadline: boolean('strict_deadline').notNull().default(false),
  repeat: repeatOptionEnum('repeat').notNull().default('No Repeat'),
  repeatInterval: integer('repeat_interval').notNull().default(1),
  repeatUnit: repeatUnitEnum('repeat_unit').notNull().default('day'),
  // 7-element boolean array for Sun–Sat
  repeatWeekdays: jsonb('repeat_weekdays')
    .$type<[boolean, boolean, boolean, boolean, boolean, boolean, boolean]>()
    .notNull()
    .default([false, false, false, false, false, false, false]),
  timeFrame: integer('time_frame').notNull().default(0),
  snooze: text('snooze'),
  subtasks: jsonb('subtasks').$type<SubTask[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const history = pgTable('history', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  taskId: uuid('task_id'),
  taskSnapshot: jsonb('task_snapshot').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const dailyProgress = pgTable(
  'daily_progress',
  {
    userId: text('user_id').notNull(),
    date: text('date').notNull(), // YYYY-M-D, matches old format
    streakBeforeToday: integer('streak_before_today').notNull().default(0),
    lives: integer('lives').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
)

export type Task = typeof tasks.$inferSelect
export type NewTask = typeof tasks.$inferInsert
export type HistoryEntry = typeof history.$inferSelect
export type NewHistoryEntry = typeof history.$inferInsert
export type DailyProgress = typeof dailyProgress.$inferSelect
export type NewDailyProgress = typeof dailyProgress.$inferInsert
