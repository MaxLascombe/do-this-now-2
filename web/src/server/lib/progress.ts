import { and, eq, gte, lt, sql } from 'drizzle-orm'

import { dailyProgress, history, tasks } from '@dtn/shared/schema'
import { dateString, getUserToday, newSafeDate } from '@dtn/shared/helpers'
import { DAY_MS } from '@dtn/shared/time'
import { ceilTaskTime } from '@dtn/shared/timer-utils'
import { db } from '../../db'
import { rowCreditMinutes } from './history-credit'
import { getUserSettings } from './settings'
import {
  buildRecap,
  computeDayTarget,
  computeProgress,
  MAX_SETTLE_DAYS,
  settleChain,
  type ProgressInputs,
  type ProgressTodayResult,
} from './progress-math'
import type { RecapDay } from '@dtn/shared/types'

export type { ProgressTodayResult }

const RECAP_DAYS = 14

// The Day Recap payload: verdicts for the last settled days, newest first.
// Settles first so yesterday's verdict exists even on the first read of a
// new day.
export async function getProgressRecap(
  userId: string,
  tzOffsetMin: number,
): Promise<Array<RecapDay>> {
  try {
    await settlePastDays(userId, tzOffsetMin)
  } catch (err) {
    console.error('settlePastDays failed in getProgressRecap', err)
  }
  const { todayDate, todayUtcStart } = getUserToday(tzOffsetMin)
  const rangeUtcStart = new Date(
    todayUtcStart.getTime() - RECAP_DAYS * 24 * 60 * 60 * 1000,
  )
  const [rows, hist] = await Promise.all([
    db
      .select()
      .from(dailyProgress)
      .where(eq(dailyProgress.userId, userId)),
    db
      .select()
      .from(history)
      .where(
        and(
          eq(history.userId, userId),
          gte(history.completedAt, rangeUtcStart),
          lt(history.completedAt, todayUtcStart),
        ),
      ),
  ])
  const doneByDay = new Map<string, number>()
  for (const row of hist) {
    const key = getUserToday(tzOffsetMin, row.completedAt).todayKey
    doneByDay.set(key, (doneByDay.get(key) ?? 0) + rowCreditMinutes(row))
  }
  return buildRecap(todayDate, rows, doneByDay, RECAP_DAYS)
}

// --- internal helpers -------------------------------------------------

async function loadProgressInputs(
  userId: string,
  todayKey: string,
  todayUtcStart: Date,
  tomorrowUtcStart: Date,
): Promise<ProgressInputs> {
  const [completedToday, todayProgressRows, bestRows, allTasks, settings] =
    await Promise.all([
      db
        .select()
        .from(history)
        .where(
          and(
            eq(history.userId, userId),
            gte(history.completedAt, todayUtcStart),
            lt(history.completedAt, tomorrowUtcStart),
          ),
        ),
      db
        .select()
        .from(dailyProgress)
        .where(
          and(eq(dailyProgress.userId, userId), eq(dailyProgress.date, todayKey)),
        ),
      db
        .select({
          best: sql<number>`coalesce(max(${dailyProgress.streakBeforeToday}), 0)`,
        })
        .from(dailyProgress)
        .where(eq(dailyProgress.userId, userId)),
      db.select().from(tasks).where(eq(tasks.userId, userId)),
      getUserSettings(userId),
    ])

  const completedTodayMin = completedToday.reduce(
    (acc, row) => acc + rowCreditMinutes(row),
    0,
  )

  const todayProgress = todayProgressRows.at(0)

  return {
    completedTodayMin,
    streakBeforeToday: todayProgress?.streakBeforeToday ?? 0,
    lives: todayProgress?.lives ?? 0,
    bestStreakBefore: bestRows.at(0)?.best ?? 0,
    allTasks: allTasks.map(ceilTaskTime),
    settings,
  }
}

async function upsertDailyRows(
  rows: Array<{
    userId: string
    date: string
    streakBeforeToday: number
    lives: number
  }>,
): Promise<void> {
  if (rows.length === 0) return
  await db
    .insert(dailyProgress)
    .values(rows)
    .onConflictDoUpdate({
      target: [dailyProgress.userId, dailyProgress.date],
      set: {
        streakBeforeToday: sql`excluded.streak_before_today`,
        lives: sql`excluded.lives`,
      },
    })
}

// Lazy day settlement (ADR-0004): the first progress read of a new day walks
// any unsettled prior days — oldest first, each absent day consuming a Daily
// Target's worth of bank until one comes up short — and writes their verdicts.
// This is the only write the GET path performs, it only backfills PAST days,
// and it is idempotent; without it a day won purely on Lives (a banked rest
// day, zero completions) would never be recorded and the whole bank would
// silently evaporate at midnight.
export async function settlePastDays(
  userId: string,
  tzOffsetMin: number,
): Promise<void> {
  const { todayDate, todayKey, todayUtcStart } = getUserToday(tzOffsetMin)
  const rows = await db
    .select()
    .from(dailyProgress)
    .where(eq(dailyProgress.userId, userId))
  // No rows at all = nothing banked, nothing to settle (fresh account).
  if (rows.length === 0) return

  const todayMs = todayDate.getTime()
  let frontier: { date: Date; streakBeforeToday: number; lives: number } | null =
    null
  for (const r of rows) {
    const d = newSafeDate(r.date)
    // Rows past today (tomorrow's rollover, written by finalize) are not a
    // settlement frontier — they'll be current when their day arrives.
    if (d.getTime() > todayMs) continue
    if (!frontier || d > frontier.date) {
      frontier = { date: d, streakBeforeToday: r.streakBeforeToday, lives: r.lives }
    }
  }
  if (!frontier || frontier.date.getTime() === todayMs) return

  const gapDays = Math.round((todayMs - frontier.date.getTime()) / DAY_MS)
  if (gapDays > MAX_SETTLE_DAYS) {
    await upsertDailyRows([
      { userId, date: todayKey, streakBeforeToday: 0, lives: 0 },
    ])
    return
  }

  const [settings, taskRows, gapHistory] = await Promise.all([
    getUserSettings(userId),
    db.select().from(tasks).where(eq(tasks.userId, userId)),
    db
      .select()
      .from(history)
      .where(
        and(
          eq(history.userId, userId),
          gte(
            history.completedAt,
            new Date(
              Date.UTC(
                frontier.date.getFullYear(),
                frontier.date.getMonth(),
                frontier.date.getDate(),
              ) +
                tzOffsetMin * 60000,
            ),
          ),
          lt(history.completedAt, todayUtcStart),
        ),
      ),
  ])
  const allTasks = taskRows.map(ceilTaskTime)

  const doneByDay = new Map<string, number>()
  for (const row of gapHistory) {
    const key = getUserToday(tzOffsetMin, row.completedAt).todayKey
    doneByDay.set(key, (doneByDay.get(key) ?? 0) + rowCreditMinutes(row))
  }

  // Each settled day writes the NEXT day's start-state row, so the last write
  // is today's row — the settlement marker future reads check for. Targets
  // are recomputed as-of-now; small drift vs. what the bar showed live is
  // accepted (ADR-0004).
  const days: Array<{ done: number; todo: number }> = []
  const rowDates: Array<string> = []
  for (let i = 0; i < gapDays; i++) {
    const day = new Date(
      frontier.date.getFullYear(),
      frontier.date.getMonth(),
      frontier.date.getDate() + i,
    )
    const done = doneByDay.get(dateString(day)) ?? 0
    days.push({
      done,
      todo: computeDayTarget(day, allTasks, done, settings).cappedTodo,
    })
    const next = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)
    rowDates.push(dateString(next))
  }

  const chain = settleChain(
    { streakBeforeToday: frontier.streakBeforeToday, lives: frontier.lives },
    days,
  )
  await upsertDailyRows(
    chain.map((c, i) => ({
      userId,
      date: rowDates[i],
      streakBeforeToday: c.streakBeforeToday,
      lives: c.lives,
    })),
  )
}

async function persistStreakRollover(
  userId: string,
  tomorrowKey: string,
  streak: number,
  lives: number,
): Promise<void> {
  await upsertDailyRows([
    { userId, date: tomorrowKey, streakBeforeToday: streak, lives },
  ])
}

// --- public entry points ----------------------------------------------

export async function getProgressToday(
  userId: string,
  tzOffsetMin: number,
): Promise<ProgressTodayResult> {
  // Settlement (past days only) is the one deliberate write on this path —
  // see ADR-0004. Today's rollover is still persisted by finalizeTodayProgress
  // (called from completeTask), never on read. A settlement failure degrades
  // to yesterday-unsettled values rather than failing the whole bar.
  try {
    await settlePastDays(userId, tzOffsetMin)
  } catch (err) {
    console.error('settlePastDays failed in getProgressToday', err)
  }
  const {
    todayDate: today,
    todayKey,
    todayUtcStart,
    tomorrowUtcStart,
  } = getUserToday(tzOffsetMin)
  const inputs = await loadProgressInputs(
    userId,
    todayKey,
    todayUtcStart,
    tomorrowUtcStart,
  )
  return computeProgress(today, inputs).result
}

// Called by completeTask after a successful completion so the streak/lives
// rollover for "tomorrow's start state" is captured at the moment `done`
// changes, not on the next GET. Idempotent via the upsert. Settles first so
// the completion is judged against a settled start state.
export async function finalizeTodayProgress(
  userId: string,
  tzOffsetMin: number,
): Promise<void> {
  await settlePastDays(userId, tzOffsetMin)
  const {
    todayDate: today,
    todayKey,
    todayUtcStart,
    tomorrowUtcStart,
  } = getUserToday(tzOffsetMin)
  const tomorrowKey = dateString(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1),
  )
  const inputs = await loadProgressInputs(
    userId,
    todayKey,
    todayUtcStart,
    tomorrowUtcStart,
  )
  const { rolloverLives, rolloverStreak } = computeProgress(today, inputs)
  if (rolloverLives !== null) {
    await persistStreakRollover(
      userId,
      tomorrowKey,
      rolloverStreak,
      rolloverLives,
    )
  }
}
