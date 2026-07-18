import {
  boolean,
  doublePrecision,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
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

// Events on a task's lifecycle that the live `tasks` row doesn't preserve.
// 'snoozed': captured each time the user snoozes (so we can compute
//   snooze frequency stats — the live `snooze` column only holds the
//   currently-active value).
// 'deleted': captured before the actual DELETE so we know how many tasks
//   were abandoned vs completed.
export const taskEventKindEnum = pgEnum('task_event_kind', [
  'snoozed',
  'deleted',
])

// Fixed: target time per repetition; over/under carries forward.
// Fluid: actual time, self-tuning via 14-period EMA bootstrap.
export const timeframeTypeEnum = pgEnum('timeframe_type', ['fixed', 'fluid'])

import type { SubTask, Task } from './types'
export type {
  DailyProgress,
  HistoryEntry,
  NewDailyProgress,
  NewHistoryEntry,
  NewTask,
  RepeatOption,
  RepeatUnit,
  RepeatWeekdays,
  SubTask,
  Task,
  TimeframeType,
} from './types'

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    title: text('title').notNull(),
    // Single emoji (occasionally a multi-codepoint sequence — skin tones,
    // ZWJ pairs). Default '📝' so the column add is safe on legacy rows;
    // an admin backfill upgrades those to real Claude-generated emojis.
    emoji: text('emoji').notNull().default('📝'),
    due: text('due').notNull(),
    // Optional time-of-day for the due date in 24h "HH:MM" form. When set,
    // the task is treated as "actionable" only once the local datetime
    // (date + time) has passed — and ranks above non-timed past-due tasks.
    dueTime: text('due_time'),
    strictDeadline: boolean('strict_deadline').notNull().default(false),
    // Off = keep the task out of the Top Tasks query until its due date
    // arrives. Default true so legacy rows keep today's behavior.
    canDoEarly: boolean('can_do_early').notNull().default(true),
    repeat: repeatOptionEnum('repeat').notNull().default('No Repeat'),
    repeatInterval: integer('repeat_interval').notNull().default(1),
    repeatUnit: repeatUnitEnum('repeat_unit').notNull().default('day'),
    // 7-element boolean array for Sun–Sat
    repeatWeekdays: jsonb('repeat_weekdays')
      .$type<[boolean, boolean, boolean, boolean, boolean, boolean, boolean]>()
      .notNull()
      .default([false, false, false, false, false, false, false]),
    // Decimal minutes. Stored as double precision so the EMA / fractional
    // measurements (e.g. 30.42 min) round-trip without truncation. When 0,
    // `timekeeperId` must be set (CHECK constraint in the migration).
    timeFrame: doublePrecision('time_frame').notNull().default(0),
    // Self-referencing FK: a zero-timeFrame task points to another task
    // whose timer covers its time. RESTRICT — block keeper deletes while
    // children exist. App-layer enforces: keeper has timeFrame>0 AND
    // timeframeType='fixed'.
    timekeeperId: uuid('timekeeper_id').references(
      (): AnyPgColumn => tasks.id,
      { onDelete: 'restrict' },
    ),
    timeframeType: timeframeTypeEnum('timeframe_type')
      .notNull()
      .default('fixed'),
    // Per-task timer. Null `timerStartedAt` ⇒ paused. The visible elapsed
    // value is `timerAccumulatedSeconds + (now - timerStartedAt)` while
    // running, otherwise just `timerAccumulatedSeconds`.
    timerStartedAt: timestamp('timer_started_at', { withTimezone: true }),
    timerAccumulatedSeconds: doublePrecision('timer_accumulated_seconds')
      .notNull()
      .default(0),
    // Fluid-task EMA bootstrap counter; capped at 14. <14 ⇒ true running
    // average of all measurements so far; ≥14 ⇒ 13/14 exponential decay.
    measurementCount: integer('measurement_count').notNull().default(0),
    snooze: text('snooze'),
    // User-defined labels for grouping/filtering.
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    subtasks: jsonb('subtasks').$type<SubTask[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // Every task query scopes by user_id; without this index Postgres
  // sequential-scans the table.
  (t) => [
    index('tasks_user_id_idx').on(t.userId),
    index('tasks_timekeeper_id_idx').on(t.timekeeperId),
  ],
)

export const history = pgTable(
  'history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    // SET NULL on task delete: the history row stays (taskSnapshot keeps the
    // displayable copy) but the live-task back-reference clears.
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    taskSnapshot: jsonb('task_snapshot').$type<Task>().notNull(),
    // Timer value at completion, in seconds. Null on legacy rows pre-timer
    // feature — readers fall back to `taskSnapshot.timeFrame * 60`.
    actualSeconds: doublePrecision('actual_seconds'),
    completedAt: timestamp('completed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // History queries always bracket (user_id, completed_at) for the day's
  // history slice and the progress-today computation.
  (t) => [
    index('history_user_id_completed_at_idx').on(t.userId, t.completedAt),
  ],
)

// Append-only lifecycle log for stats. taskId SET NULL on delete so the
// row survives even after the task is hard-deleted (and 'deleted' events
// always satisfy the FK because they're inserted *before* the delete).
export const taskEvents = pgTable(
  'task_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    taskId: uuid('task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    kind: taskEventKindEnum('kind').notNull(),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('task_events_user_id_at_idx').on(t.userId, t.at)],
)

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

// One row per user holding cross-device UI state. `selectedTaskId` is the
// task the user has committed to focusing on right now — authoritative and
// shared across devices. ON DELETE SET NULL so deleting the task clears the
// selection at the database level (no app code, no race).
export const userState = pgTable('user_state', {
  userId: text('user_id').primaryKey(),
  selectedTaskId: uuid('selected_task_id').references(() => tasks.id, {
    onDelete: 'set null',
  }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// A phone that can show the Lock Screen Timer. The row IS the widget's
// credential: `tokenHash` is the sha256 of a server-issued secret the app
// stores in the device Keychain; the widget's Pause/Resume authenticates
// with it (Clerk JWTs expire too fast for a widget extension to hold).
// Revoke = delete the row.
export const lockScreenDevices = pgTable(
  'lock_screen_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    // Human label for a future "devices" management UI, e.g. "iPhone".
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('lock_screen_devices_user_id_idx').on(t.userId)],
)

// 'start': the device-wide ActivityKit push-to-start token (launches a new
//   Live Activity when nothing is on the lock screen yet).
// 'update': the per-activity token (updates/ends the activity in place).
export const livePushTokenKindEnum = pgEnum('live_push_token_kind', [
  'start',
  'update',
])

// APNs tokens for driving the Lock Screen Timer remotely. One 'start' row
// per device; the 'update' row is replaced each time a new activity starts
// on that device (an ended activity's token is useless, so we keep only the
// latest). Cascade with the device row — revoking a device kills its pushes.
export const livePushTokens = pgTable(
  'live_push_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => lockScreenDevices.id, { onDelete: 'cascade' }),
    kind: livePushTokenKindEnum('kind').notNull(),
    token: text('token').notNull(),
    // 'start' rows only: when we last sent a push-to-start that hasn't been
    // acknowledged by an update-token registration. Guards against creating
    // duplicate activities — iOS makes a NEW activity for every start push.
    startSentAt: timestamp('start_sent_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('live_push_tokens_user_id_idx').on(t.userId),
    uniqueIndex('live_push_tokens_device_kind_idx').on(t.deviceId, t.kind),
  ],
)

// Global cache of Claude-generated emoji suggestions, keyed by normalized
// task title, so a repeated title is served from Postgres instead of a fresh
// model call. User-agnostic on purpose — the title→emoji mapping is the same
// for everyone, which maximizes hits.
export const emojiSuggestions = pgTable('emoji_suggestions', {
  title: text('title').primaryKey(),
  emojis: jsonb('emojis').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

