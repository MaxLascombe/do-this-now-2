import { and, eq, gte, isNull, lt } from 'drizzle-orm'

import { dailyProgress, history, tasks } from '@dtn/shared/schema'
import { dateString, getUserToday } from '@dtn/shared/helpers'
import { ceilTaskTime } from '@dtn/shared/timer-utils'
import { db } from '../../db'
import { rowCreditMinutes } from './history-credit'
import {
  computeProgress,
  type ProgressInputs,
  type ProgressTodayResult,
} from './progress-math'

export type { ProgressTodayResult }

// --- internal helpers -------------------------------------------------

async function loadProgressInputs(
  userId: string,
  todayKey: string,
  todayUtcStart: Date,
  tomorrowUtcStart: Date,
): Promise<ProgressInputs> {
  const [completedToday, todayProgressRows, allTasks] = await Promise.all([
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
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), isNull(tasks.archivedAt))),
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
    allTasks: allTasks.map(ceilTaskTime),
  }
}

async function persistStreakRollover(
  userId: string,
  tomorrowKey: string,
  streak: number,
  lives: number,
): Promise<void> {
  await db
    .insert(dailyProgress)
    .values({ userId, date: tomorrowKey, streakBeforeToday: streak, lives })
    .onConflictDoUpdate({
      target: [dailyProgress.userId, dailyProgress.date],
      set: { streakBeforeToday: streak, lives },
    })
}

// --- public entry points ----------------------------------------------

export async function getProgressToday(
  userId: string,
  tzOffsetMin: number,
): Promise<ProgressTodayResult> {
  // Read-only. Streak/lives rollover is persisted by finalizeTodayProgress
  // (called from completeTask), not from this GET path — REST GETs must not
  // have side effects, and the previous design wrote on every refresh while
  // the target was hit.
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
// changes, not on the next GET. Idempotent via the upsert.
export async function finalizeTodayProgress(
  userId: string,
  tzOffsetMin: number,
): Promise<void> {
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
