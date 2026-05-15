import type { Task } from './types'

// The React Query persister serializes the cache to localStorage /
// AsyncStorage as JSON, which loses the Date class. On page reload the
// rehydrated object's `timerStartedAt` arrives as an ISO string, not a
// Date, so calling `.getTime()` on it crashes. Coerce here so every
// callsite — widget, chip, gate, optimistic mutation — gets a Date.
function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  return value instanceof Date ? value : new Date(value)
}

// Shared math for the "live" elapsed seconds of a task's timer. Mirrors
// web/src/server/lib/timer.ts.currentTimerSeconds — the same formula
// must run on both sides so client and server agree on the value at the
// moment Done is clicked.
export function currentTimerSeconds(task: Task, now: Date): number {
  const started = toDateOrNull(task.timerStartedAt)
  if (started) {
    const elapsed = (now.getTime() - started.getTime()) / 1000
    return Math.max(0, task.timerAccumulatedSeconds + elapsed)
  }
  return task.timerAccumulatedSeconds
}

// "Is the Done button locked until the timer hits the target?" Yes when
// the task is a *repeating* *fixed* *non-child* task — that's the case
// where the timer's value is supposed to gate completion (a habit you're
// trying to hit a target on). Falls open in every other case:
//   - fluid: timer is descriptive, not prescriptive — never gate.
//   - one-shot fixed: per the design decision (#A), Done is always
//     enabled so a 60m one-off task doesn't get you stuck.
//   - children of a timekeeper: own timer is irrelevant; the parent
//     keeper's completion is what carries the time-tracking weight.
export function isCompletionGated(task: Task, now: Date): boolean {
  if (task.timeframeType !== 'fixed') return false
  if (task.repeat === 'No Repeat') return false
  if (task.timekeeperId !== null) return false
  const targetSec = task.timeFrame * 60
  if (targetSec <= 0) return false
  return currentTimerSeconds(task, now) < targetSec
}
