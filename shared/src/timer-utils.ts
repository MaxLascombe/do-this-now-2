import type { Task } from './types'

// Round at the API boundary so EMA decimals don't leak to the UI / aggregates; DB keeps full precision for internal math.
export function ceilTaskTime<T extends Pick<Task, 'timeFrame'>>(task: T): T {
  return { ...task, timeFrame: Math.ceil(task.timeFrame) }
}

export function formatTimerSeconds(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

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

// Pausing a fixed-time-frame task whose timer has reached its planned target
// is the "I'm done" signal — the caller completes it. True only for fixed
// tasks with a real target whose elapsed time is at or over that target.
export function shouldCompleteOnPause(task: Task, now: Date): boolean {
  if (task.timeframeType !== 'fixed') return false
  const targetSec = task.timeFrame * 60
  if (targetSec <= 0) return false
  return currentTimerSeconds(task, now) >= targetSec
}

// "When the user clicks Done, do we need to ask whether to count this
// time toward the estimate?" Only fires for fluid tasks where the
// estimate exists and the recorded time is far from the planned target
// in either direction. Note: actual = 0 is intentionally NOT excluded —
// the user may legitimately complete an instance with zero time because
// they front-loaded the work on a prior overdue day, and counting those
// zeros pulls the EMA average down so it reflects reality.
//   - 'over' when actual > 1.5× planned
//   - 'under' when actual < 0.5× planned (including actual = 0)
export function completionConfirmKind(
  task: Task,
  now: Date,
): 'over' | 'under' | null {
  if (task.timeframeType !== 'fluid') return null
  // One-shot fluid: nothing to update — task disappears on Done, EMA never runs.
  if (task.repeat === 'No Repeat') return null
  const plannedSec = task.timeFrame * 60
  if (plannedSec <= 0) return null
  const actualSec = currentTimerSeconds(task, now)
  if (actualSec > plannedSec * 1.5) return 'over'
  if (actualSec < plannedSec * 0.5) return 'under'
  return null
}

// Prompt copy for the count/don't-count dialog. The action isn't really
// "are you sure you want to complete?" — both choices complete the task.
// The user is deciding whether this session's recorded time should
// update the running 14-period EMA estimate or be skipped as a non-
// measurement.
export function confirmMessage(
  task: Task,
  now: Date,
  kind: 'over' | 'under',
): string {
  const plannedMin = Math.round(task.timeFrame)
  const actualMin = Math.round(currentTimerSeconds(task, now) / 60)
  const direction = kind === 'over' ? 'over 1.5×' : 'under 50% of'
  return `Timer is at ${actualMin} min — ${direction} the ${plannedMin} min estimate. Count this time toward the estimate?`
}
