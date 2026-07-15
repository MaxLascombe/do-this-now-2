import { and, eq } from 'drizzle-orm'

import { userState } from '@dtn/shared/schema'
import { db } from '../../db'

type Conn = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0]

export type Selection = { selectedTaskId: string | null }

export async function getSelection(userId: string): Promise<Selection> {
  const rows = await db
    .select({ selectedTaskId: userState.selectedTaskId })
    .from(userState)
    .where(eq(userState.userId, userId))
    .limit(1)
  return { selectedTaskId: rows[0]?.selectedTaskId ?? null }
}

// Upsert the selection pointer. Takes a connection so it can run inside the
// timer transaction — selecting a task and starting its timer commit together.
export async function setSelectionTx(
  conn: Conn,
  userId: string,
  selectedTaskId: string | null,
  now: Date,
): Promise<void> {
  await conn
    .insert(userState)
    .values({ userId, selectedTaskId, updatedAt: now })
    .onConflictDoUpdate({
      target: userState.userId,
      set: { selectedTaskId, updatedAt: now },
    })
}

// Drop the Selected Task pointer, but only if it currently points at
// `taskId`. Runs inside the complete/snooze transaction so a task that
// leaves the active list also leaves the Focus View — while never
// disturbing a pointer aimed at some other task.
export async function clearSelectionIfTx(
  conn: Conn,
  userId: string,
  taskId: string,
  now: Date,
): Promise<void> {
  await conn
    .update(userState)
    .set({ selectedTaskId: null, updatedAt: now })
    .where(
      and(
        eq(userState.userId, userId),
        eq(userState.selectedTaskId, taskId),
      ),
    )
}
