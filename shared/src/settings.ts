import { z } from 'zod'

import { MINUTES_IN_DAY, START_OF_DAY_MINUTES } from './time'

// Per-user progress settings. The Workday is the window pacing spreads the
// Daily Target across; horizonDays is the rolling window the target averages
// upcoming due work over.
export type UserSettings = {
  workdayStartMin: number
  workdayEndMin: number
  horizonDays: number
}

export const DEFAULT_SETTINGS: UserSettings = {
  workdayStartMin: START_OF_DAY_MINUTES,
  workdayEndMin: MINUTES_IN_DAY,
  horizonDays: 14,
}

export const settingsInputSchema = z
  .object({
    workdayStartMin: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_IN_DAY - 30),
    workdayEndMin: z.number().int().min(30).max(MINUTES_IN_DAY),
    horizonDays: z.number().int().min(1).max(60),
  })
  .refine((s) => s.workdayEndMin - s.workdayStartMin >= 30, {
    message: 'workday must be at least 30 minutes long',
  })

export type SettingsInput = z.infer<typeof settingsInputSchema>

// 510 → "08:30", 1440 → "24:00" (end-of-day, which HH:MM inputs can't say).
export const minutesOfDayToHHMM = (min: number): string => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
