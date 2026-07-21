import { eq } from 'drizzle-orm'

import { userSettings } from '@dtn/shared/schema'
import { DEFAULT_SETTINGS, type UserSettings } from '@dtn/shared/settings'
import { db } from '../../db'

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const row = (
    await db.select().from(userSettings).where(eq(userSettings.userId, userId))
  ).at(0)
  if (!row) return DEFAULT_SETTINGS
  return {
    workdayStartMin: row.workdayStartMin,
    workdayEndMin: row.workdayEndMin,
    horizonDays: row.horizonDays,
  }
}

export async function saveUserSettings(
  userId: string,
  input: UserSettings,
): Promise<UserSettings> {
  await db
    .insert(userSettings)
    .values({ userId, ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...input, updatedAt: new Date() },
    })
  return input
}
