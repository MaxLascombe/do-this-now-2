import AsyncStorage from '@react-native-async-storage/async-storage'
import { newSafeDateTime } from '@dtn/shared/helpers'
import { minutesToHours } from '@dtn/shared/time'
import {
  currentTimerSeconds,
  runawayThresholdSeconds,
} from '@dtn/shared/timer-utils'
import type { ProgressTodayResult } from '@dtn/shared/api-client'
import type { UserSettings } from '@dtn/shared/settings'
import type { Task } from '@dtn/shared/types'
import * as Notifications from 'expo-notifications'

// On-device notification scheduling (features 6+7 of the 2026-07-21 plan):
// no server cron — every replan cancels and reschedules from the freshest
// synced data. Four triggers, each with its own opt-in toggle:
//   dueTime     — a task's due date + due-time arrives
//   snoozeWake  — a snoozed task comes back
//   streakRisk  — pace-based: the projected moment remaining-to-win becomes
//                 uncoverable at tick pace (the pace formula is a tunable)
//   morningBrief — Workday start: today's terms, always sent (a pre-won day
//                 says so)

export type NotificationToggles = {
  dueTime: boolean
  snoozeWake: boolean
  streakRisk: boolean
  morningBrief: boolean
  runawayTimer: boolean
}

export const DEFAULT_TOGGLES: NotificationToggles = {
  dueTime: false,
  snoozeWake: false,
  streakRisk: false,
  morningBrief: false,
  runawayTimer: false,
}

const TOGGLES_KEY = 'dtn-notification-toggles'

// iOS caps pending local notifications at 64; leave headroom for the
// non-due-time triggers.
const MAX_DUE_NOTIFICATIONS = 40
const DUE_HORIZON_DAYS = 7

export async function loadToggles(): Promise<NotificationToggles> {
  try {
    const raw = await AsyncStorage.getItem(TOGGLES_KEY)
    return raw
      ? { ...DEFAULT_TOGGLES, ...(JSON.parse(raw) as NotificationToggles) }
      : DEFAULT_TOGGLES
  } catch {
    return DEFAULT_TOGGLES
  }
}

export async function saveToggles(t: NotificationToggles): Promise<void> {
  await AsyncStorage.setItem(TOGGLES_KEY, JSON.stringify(t))
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return true
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

// Show scheduled notifications even when the app is foregrounded — the beats
// are quiet (no sound, no badge) by design.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

const at = (date: Date) => ({
  type: Notifications.SchedulableTriggerInputTypes.DATE as const,
  date,
})

export async function replanNotifications(args: {
  tasks: Array<Task>
  progress: ProgressTodayResult | undefined
  settings: UserSettings | undefined
  toggles: NotificationToggles
}): Promise<void> {
  const { tasks, progress, settings, toggles } = args
  const anyOn = Object.values(toggles).some(Boolean)
  const perms = await Notifications.getPermissionsAsync()
  if (!perms.granted) return
  await Notifications.cancelAllScheduledNotificationsAsync()
  if (!anyOn) return

  const now = new Date()
  const horizon = new Date(now.getTime() + DUE_HORIZON_DAYS * 24 * 3600 * 1000)

  if (toggles.dueTime) {
    const due = tasks
      .filter((t) => t.dueTime)
      .map((t) => ({ t, when: newSafeDateTime(t.due, t.dueTime as string) }))
      .filter(({ when }) => when > now && when < horizon)
      .sort((a, b) => a.when.getTime() - b.when.getTime())
      .slice(0, MAX_DUE_NOTIFICATIONS)
    for (const { t, when } of due) {
      await Notifications.scheduleNotificationAsync({
        content: { title: `${t.emoji} ${t.title}`, body: 'Due now' },
        trigger: at(when),
      })
    }
  }

  if (toggles.snoozeWake) {
    for (const t of tasks) {
      if (!t.snooze) continue
      const wake = new Date(t.snooze)
      if (!(wake > now) || wake > horizon) continue
      await Notifications.scheduleNotificationAsync({
        content: { title: `${t.emoji} ${t.title}`, body: 'Back on the list' },
        trigger: at(wake),
      })
    }
  }

  if (toggles.streakRisk && progress && settings) {
    const { done, lives, todo, workdayEndMin, workdayStartMin } = progress
    const remaining = todo - done - lives
    if (remaining > 0) {
      // Tick pace: the rate the Daily Target expects across the Workday.
      const pace = todo / Math.max(1, workdayEndMin - workdayStartMin)
      const riskMin = workdayEndMin - remaining / pace
      const risk = new Date(now)
      risk.setHours(0, Math.round(riskMin), 0, 0)
      if (risk > now) {
        const leftAtRisk = Math.max(0, workdayEndMin - riskMin)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '▲ Streak at risk',
            body: `${minutesToHours(remaining)} still to win · ${minutesToHours(
              Math.round(leftAtRisk),
            )} of workday left`,
          },
          trigger: at(risk),
        })
      }
    }
  }

  if (toggles.runawayTimer) {
    // The Runaway Guard's "flag and notify": alert at the earlier of the
    // 3×-plan moment and local midnight for whatever timer is running now.
    for (const t of tasks) {
      if (!t.timerStartedAt) continue
      const elapsed = currentTimerSeconds(t, now)
      const threshold = runawayThresholdSeconds(t.timeFrame)
      const candidates: Array<Date> = []
      if (elapsed < threshold) {
        candidates.push(new Date(now.getTime() + (threshold - elapsed) * 1000))
      }
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      )
      candidates.push(midnight)
      const when = new Date(
        Math.min(...candidates.map((d) => d.getTime())),
      )
      if (when <= now) continue
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏱ ${t.emoji} ${t.title}`,
          body: 'Timer is running away — still working?',
        },
        trigger: at(when),
      })
    }
  }

  if (toggles.morningBrief && progress && settings) {
    const brief = new Date(now)
    brief.setHours(0, settings.workdayStartMin, 0, 0)
    if (brief <= now) brief.setDate(brief.getDate() + 1)
    const { todo, lives } = progress
    const top = tasks.find((t) => !t.snooze)
    const won = todo > 0 && lives >= todo
    const body = won
      ? `Rest day earned: bank ${minutesToHours(lives)} ≥ target ${minutesToHours(todo)}`
      : `Target ${minutesToHours(todo)} · ♥ ${minutesToHours(lives)} banked${
          top ? ` · top: ${top.emoji} ${top.title}` : ''
        }`
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Today', body },
      trigger: at(brief),
    })
  }
}
