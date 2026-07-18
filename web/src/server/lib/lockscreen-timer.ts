import { and, eq } from 'drizzle-orm'

import { tasks } from '@dtn/shared/schema'
import { shouldCompleteOnPause } from '@dtn/shared/timer-utils'
import { db } from '../../db'
import { completeTask } from './actions'
import { buildLockScreenState, syncLockScreen } from './lockscreen'
import { getSelection } from './selection'
import { applyTimerAction } from './timer'
import type { LockScreenState } from './lockscreen'
import type { Task } from '@dtn/shared/schema'

export type LockScreenTimerAction = {
  action: 'pause' | 'resume'
  at?: string
}

async function loadTask(userId: string, id: string): Promise<Task | null> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ?? null
}

// The widget's Pause/Resume, carrying the app's full timer semantics
// (ADR-0004): resume = the same start action the app issues (selection
// sticks to the acted-on id, server resolves Child→Keeper); pause on a
// fixed task at its target = completion, exactly like the in-app pause
// path — completeTask runs it in one transaction. Returns the fresh state
// so the widget can update its own activity without waiting on the push.
export async function applyLockScreenTimerAction(
  userId: string,
  { action, at }: LockScreenTimerAction,
  tzOffsetMin: number,
): Promise<LockScreenState | null> {
  const { selectedTaskId } = await getSelection(userId)
  const selected = selectedTaskId
    ? await loadTask(userId, selectedTaskId)
    : null

  if (selected) {
    const timerTask = selected.timekeeperId
      ? await loadTask(userId, selected.timekeeperId)
      : selected
    if (action === 'resume') {
      await applyTimerAction(userId, selected.id, { kind: 'start', at })
    } else if (timerTask) {
      // Same guard as the app: only a pause that stops a *running* timer
      // may auto-complete; a no-op re-pause must not re-fire completion.
      const wasRunning = timerTask.timerStartedAt !== null
      if (wasRunning && shouldCompleteOnPause(timerTask, new Date())) {
        await completeTask(userId, timerTask.id, tzOffsetMin)
      } else {
        await applyTimerAction(userId, selected.id, { kind: 'pause', at })
      }
    }
  }

  void syncLockScreen(userId).catch((err) =>
    console.error('syncLockScreen after widget action failed', err),
  )
  return buildLockScreenState(userId)
}
