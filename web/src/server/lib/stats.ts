import { eq } from 'drizzle-orm'

import { newSafeDate } from '@dtn/shared/helpers'
import {
  dailyProgress,
  history,
  taskEvents,
  tasks,
  type Task,
} from '@dtn/shared/schema'
import { DAY_MS } from '@dtn/shared/time'
import { db } from '../../db'

export type StatsResult = {
  // Calendar heatmap: last 182 days (26 weeks ≈ 6 months), oldest first.
  // `minutes` is the sum of completed task timeFrames that day.
  // `hit` is true iff that day's target was met (we derive it from the
  // existence of a daily_progress row for d+1, which is only written when
  // the prior day's target was actually hit). Client colors a 4-tier
  // gradient: 0 min = gray, >0 = dim/medium green, hit = bright green.
  heatmap: Array<{ date: string; minutes: number; hit: boolean }>

  // Streak summary
  currentStreak: number
  longestStreak: number
  totalDaysHit: number

  // Last 30 days minutes done (oldest first, including today)
  last30Days: Array<{ date: string; minutes: number }>

  // 24-bucket array, count of completions per hour-of-day (local time)
  hourOfDay: number[]
  // 7-bucket, 0=Sun .. 6=Sat
  dayOfWeek: number[]

  // Top 10 most-completed task titles
  topTasks: Array<{ title: string; emoji: string; count: number }>
  // Emoji frequencies, sorted desc
  emojiFreq: Array<{ emoji: string; count: number }>

  // 0..1, share of completions where completedAt's local day <= due date.
  // null if there are no completions.
  onTimeRate: number | null
  // Average completion latency in days for one-shot tasks (taskSnapshot
  // had repeat === 'No Repeat'). null if no qualifying rows.
  avgLatencyDays: number | null

  // Vanity counters
  totalAllTime: number
  totalThisMonth: number
  totalThisWeek: number
  totalToday: number

  // Snooze events
  snoozesAllTime: number
  snoozesThisWeek: number

  // Abandoned (deleted) events + ratio of deletes / (deletes + completions)
  abandonedCount: number
  abandonmentRate: number | null
}

// Convert a UTC instant to the user's local YYYY-M-D key. Matches the
// shape produced by `dateString` in @dtn/shared/helpers — no zero padding.
function localDateKey(utcMs: number, tzOffsetMin: number): string {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  const y = shifted.getUTCFullYear()
  const m = shifted.getUTCMonth() + 1
  const d = shifted.getUTCDate()
  return `${y}-${m}-${d}`
}

// User-local hour-of-day (0..23) for a UTC instant.
function localHour(utcMs: number, tzOffsetMin: number): number {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  return shifted.getUTCHours()
}

// User-local day-of-week (0=Sun .. 6=Sat) for a UTC instant.
function localDayOfWeek(utcMs: number, tzOffsetMin: number): number {
  const shifted = new Date(utcMs - tzOffsetMin * 60000)
  return shifted.getUTCDay()
}

export async function getStats(
  userId: string,
  tzOffsetMin: number,
): Promise<StatsResult> {
  const [historyRows, eventRows, dailyRows, liveTaskRows] = await Promise.all([
    db.select().from(history).where(eq(history.userId, userId)),
    db.select().from(taskEvents).where(eq(taskEvents.userId, userId)),
    db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId)),
    db
      .select({ title: tasks.title, emoji: tasks.emoji })
      .from(tasks)
      .where(eq(tasks.userId, userId)),
  ])

  // Live tasks are the source of truth for current emoji. taskSnapshot
  // in history was captured before the emoji column existed (or with the
  // '📝' default), so trusting it directly produces a sea of placeholders
  // for tasks the user later picked a real emoji for.
  const liveEmojiByTitle = new Map<string, string>()
  for (const t of liveTaskRows) liveEmojiByTitle.set(t.title, t.emoji)

  // --- date scaffolding ----------------------------------------------
  const nowMs = Date.now()
  const todayKey = localDateKey(nowMs, tzOffsetMin)

  // Build a Set of "hit" date keys: a day d is hit iff a daily_progress
  // row exists for d+1 (the rollover-write is the persisted hit signal).
  const hitDates = new Set<string>()
  for (const row of dailyRows) {
    // row.date is the "tomorrow" key from the day that hit; subtract 1.
    const [y, m, d] = row.date.split('-').map((p) => parseInt(p))
    const dayBefore = new Date(y, m - 1, d - 1)
    hitDates.add(
      `${dayBefore.getFullYear()}-${dayBefore.getMonth() + 1}-${dayBefore.getDate()}`,
    )
  }

  // --- minutes-by-day aggregation (used by heatmap + last30Days) -----
  const minutesByDay = new Map<string, number>()
  for (const row of historyRows) {
    const key = localDateKey(row.completedAt.getTime(), tzOffsetMin)
    const min = row.taskSnapshot?.timeFrame ?? 0
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + min)
  }

  // --- heatmap (last 182 days = 26 weeks ≈ 6 months) -----------------
  const heatmap: Array<{ date: string; minutes: number; hit: boolean }> = []
  for (let i = 181; i >= 0; i--) {
    const ms = nowMs - i * DAY_MS
    const key = localDateKey(ms, tzOffsetMin)
    heatmap.push({
      date: key,
      minutes: minutesByDay.get(key) ?? 0,
      hit: hitDates.has(key),
    })
  }

  // --- streak summary ------------------------------------------------
  // currentStreak: walk back from today; count consecutive hits.
  let currentStreak = 0
  for (let i = 0; i < 1000; i++) {
    const key = localDateKey(nowMs - i * DAY_MS, tzOffsetMin)
    if (hitDates.has(key)) currentStreak++
    else if (i > 0) break
    // i===0 (today): missing is fine, streak continues from yesterday if it hit.
    else if (i === 0 && !hitDates.has(key)) continue
  }
  // Longest: walk all hitDates sorted, find longest consecutive run.
  const sorted = [...hitDates]
    .map((s) => {
      const [y, m, d] = s.split('-').map((p) => parseInt(p))
      return new Date(y, m - 1, d).getTime()
    })
    .sort((a, b) => a - b)
  let longestStreak = 0
  let run = 0
  let prev: number | null = null
  for (const t of sorted) {
    if (prev === null || t - prev > DAY_MS + 60000) {
      // gap (>1 day allowing some slack for DST)
      run = 1
    } else {
      run++
    }
    if (run > longestStreak) longestStreak = run
    prev = t
  }
  const totalDaysHit = hitDates.size

  // --- last 30 days minutes ------------------------------------------
  // minutesByDay already aggregated above for the heatmap; just project
  // the most recent 30 entries.
  const last30Days: Array<{ date: string; minutes: number }> = []
  for (let i = 29; i >= 0; i--) {
    const key = localDateKey(nowMs - i * DAY_MS, tzOffsetMin)
    last30Days.push({ date: key, minutes: minutesByDay.get(key) ?? 0 })
  }

  // --- hour-of-day + day-of-week + emoji + top tasks -----------------
  // Per-completion emoji: prefer the live task's current emoji (the user
  // may have set / changed it after this completion was recorded), fall
  // back to whatever was snapshotted in history.
  const hourOfDay = new Array<number>(24).fill(0)
  const dayOfWeek = new Array<number>(7).fill(0)
  const emojiCounts = new Map<string, number>()
  const titleCounts = new Map<string, number>()
  for (const row of historyRows) {
    const t = row.completedAt.getTime()
    hourOfDay[localHour(t, tzOffsetMin)]++
    dayOfWeek[localDayOfWeek(t, tzOffsetMin)]++
    const snap = row.taskSnapshot
    if (!snap?.title) continue
    const emoji = liveEmojiByTitle.get(snap.title) ?? snap.emoji ?? '📝'
    emojiCounts.set(emoji, (emojiCounts.get(emoji) ?? 0) + 1)
    titleCounts.set(snap.title, (titleCounts.get(snap.title) ?? 0) + 1)
  }
  const topTasks = [...titleCounts.entries()]
    .map(([title, count]) => ({
      title,
      count,
      emoji: liveEmojiByTitle.get(title) ?? '📝',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
  const emojiFreq = [...emojiCounts.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count)

  // --- on-time + latency ---------------------------------------------
  let onTimeHits = 0
  let onTimeTotal = 0
  let latencySumDays = 0
  let latencyTotal = 0
  for (const row of historyRows) {
    const snap = row.taskSnapshot as Task | undefined
    if (!snap) continue
    onTimeTotal++
    // On-time iff the local date of completedAt is <= the task's due date.
    const completedKey = localDateKey(
      row.completedAt.getTime(),
      tzOffsetMin,
    )
    try {
      if (newSafeDate(completedKey) <= newSafeDate(snap.due)) onTimeHits++
    } catch {
      // bad snapshot data — skip
    }
    // Latency only for non-repeating tasks (others recreate themselves).
    if (snap.repeat === 'No Repeat' && snap.createdAt) {
      const createdMs = new Date(snap.createdAt).getTime()
      const latencyMs = row.completedAt.getTime() - createdMs
      if (latencyMs >= 0) {
        latencySumDays += latencyMs / DAY_MS
        latencyTotal++
      }
    }
  }
  const onTimeRate = onTimeTotal === 0 ? null : onTimeHits / onTimeTotal
  const avgLatencyDays =
    latencyTotal === 0 ? null : latencySumDays / latencyTotal

  // --- vanity counters -----------------------------------------------
  // "This week" = last 7 days; "this month" = last 30 days. Calendar-week
  // boundaries are noisy across timezones; rolling windows are friendlier.
  const weekStartMs = nowMs - 7 * DAY_MS
  const monthStartMs = nowMs - 30 * DAY_MS
  let totalToday = 0
  let totalThisWeek = 0
  let totalThisMonth = 0
  for (const row of historyRows) {
    const t = row.completedAt.getTime()
    if (localDateKey(t, tzOffsetMin) === todayKey) totalToday++
    if (t >= weekStartMs) totalThisWeek++
    if (t >= monthStartMs) totalThisMonth++
  }
  const totalAllTime = historyRows.length

  // --- snooze + abandonment ------------------------------------------
  let snoozesAllTime = 0
  let snoozesThisWeek = 0
  let abandonedCount = 0
  for (const ev of eventRows) {
    if (ev.kind === 'snoozed') {
      snoozesAllTime++
      if (ev.at.getTime() >= weekStartMs) snoozesThisWeek++
    } else if (ev.kind === 'deleted') {
      abandonedCount++
    }
  }
  const abandonmentRate =
    abandonedCount + totalAllTime === 0
      ? null
      : abandonedCount / (abandonedCount + totalAllTime)

  return {
    heatmap,
    currentStreak,
    longestStreak,
    totalDaysHit,
    last30Days,
    hourOfDay,
    dayOfWeek,
    topTasks,
    emojiFreq,
    onTimeRate,
    avgLatencyDays,
    totalAllTime,
    totalThisMonth,
    totalThisWeek,
    totalToday,
    snoozesAllTime,
    snoozesThisWeek,
    abandonedCount,
    abandonmentRate,
  }
}
