import { createHash, randomBytes } from 'node:crypto'

import { and, eq } from 'drizzle-orm'

import { lockScreenDevices } from '@dtn/shared/schema'
import { db } from '../../db'

// Device-token auth for the Lock Screen Timer (ADR-0004): the widget
// extension can't refresh Clerk JWTs, so the app fetches a long-lived
// server-issued secret once (Clerk-authed) and hands it to the widget via
// the shared Keychain. Only the sha256 lands in Postgres.

const hash = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex')

export type IssuedDeviceToken = { deviceId: string; token: string }

export async function issueDeviceToken(
  userId: string,
  label: string | null,
): Promise<IssuedDeviceToken> {
  const token = `dtnlst_${randomBytes(32).toString('hex')}`
  const [row] = await db
    .insert(lockScreenDevices)
    .values({ userId, tokenHash: hash(token), label })
    .returning({ id: lockScreenDevices.id })
  return { deviceId: row.id, token }
}

export type DeviceAuth = { userId: string; deviceId: string }

// Resolve a raw device token to its row id without touching lastSeenAt —
// used to identify a request's originating device, not to authenticate it.
// Scoped to the authenticated user so a foreign token can never name a device.
export async function deviceIdForToken(
  userId: string,
  token: string,
): Promise<string | null> {
  if (!token.startsWith('dtnlst_')) return null
  const rows = await db
    .select({ id: lockScreenDevices.id })
    .from(lockScreenDevices)
    .where(
      and(
        eq(lockScreenDevices.userId, userId),
        eq(lockScreenDevices.tokenHash, hash(token)),
      ),
    )
    .limit(1)
  return rows[0]?.id ?? null
}

// Resolve `Authorization: Bearer dtnlst_…` to the device row. Null on any
// mismatch — routes translate that to 401. Bumps lastSeenAt (fire-and-forget)
// so a future devices UI can show staleness.
export async function authenticateDeviceToken(
  request: Request,
): Promise<DeviceAuth | null> {
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token.startsWith('dtnlst_')) return null
  const rows = await db
    .select({ id: lockScreenDevices.id, userId: lockScreenDevices.userId })
    .from(lockScreenDevices)
    .where(eq(lockScreenDevices.tokenHash, hash(token)))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  void db
    .update(lockScreenDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(lockScreenDevices.id, row.id))
    .catch(() => {})
  return { userId: row.userId, deviceId: row.id }
}
