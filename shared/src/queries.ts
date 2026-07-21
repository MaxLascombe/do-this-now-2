import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import type {
  ApiClient,
  ProgressTodayResult,
  SelectionResult,
  TimerAction,
} from './api-client'
import { useApi } from './api-client'
import { isSnoozed, showsInTopTasks, sortTasks } from './task-sorting'
import {
  completeTaskTransition,
  snoozeTaskTransition,
} from './task-transitions'
import { currentTimerSeconds, shouldCompleteOnPause } from './timer-utils'
import { HOUR_MS } from './time'
import { taskToInput } from './task-input'
import { undoRef, useUndo } from './undo'
import type { TaskInput } from './task-input'
import type { UserSettings } from './settings'
import type { Task } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  top: ['tasks', 'top'] as const,
  list: ['tasks', 'all'] as const,
  one: (id: string) => ['tasks', 'get', id] as const,
}
export const selectionKey = ['selection'] as const
export const historyKey = (date: string) => ['history', date] as const
export const progressTodayKey = ['progresstoday'] as const
export const progressRecapKey = ['progressrecap'] as const
export const settingsKey = ['settings'] as const
export const statsKey = ['stats'] as const

export const invalidateTaskCaches = (qc: QueryClient) => {
  // Prefix-match: invalidates taskKeys.top, taskKeys.list, and every
  // taskKeys.one(id) in one call.
  qc.invalidateQueries({ queryKey: taskKeys.all })
  qc.invalidateQueries({ queryKey: progressTodayKey })
}

// Optimistic helpers ----------------------------------------------------
// complete/snooze/delete update the active lists right now. Completing a
// repeating task keeps it in place at its next due date (re-sorted); a
// one-shot completion, a task-scope snooze, and delete remove it. The
// onSettled refetch reconciles the exact server state either way.
//
// useCompleteTask additionally bumps progressToday.done by the task's
// timeFrame so the progress bar moves at the same instant the row
// vanishes — without it the bar lagged a full refetch round-trip behind.

type OptimisticSnapshot = {
  prevTop: Task[] | undefined
  prevList: Task[] | undefined
  prevProgress?: ProgressTodayResult | undefined
  // Captured when an update needs to rollback the single-task cache too.
  prevOne?: { id: string; value: Task | undefined }
}

function findTaskInCaches(qc: QueryClient, id: string): Task | undefined {
  return (
    qc.getQueryData<Task[]>(taskKeys.list)?.find((t) => t.id === id) ??
    qc.getQueryData<Task[]>(taskKeys.top)?.find((t) => t.id === id)
  )
}

async function optimisticRemove(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const remove = (xs: Task[] | undefined) => xs?.filter((t) => t.id !== id)
  qc.setQueryData<Task[]>(taskKeys.top, remove)
  qc.setQueryData<Task[]>(taskKeys.list, remove)
  return { prevTop, prevList }
}

// The server's top query omits tasks that can't be done early until their
// due date; mirror that whenever a top-cache write may have pushed a task's
// due date past today (e.g. completing a repeating task), so the row
// vanishes now instead of on the next refetch.
const dropHiddenFromTop =
  (write: (xs: Task[] | undefined) => Task[] | undefined, today: Date) =>
  (xs: Task[] | undefined) =>
    write(xs)?.filter((t) => showsInTopTasks(t, today))

async function replaceTaskInCaches(
  qc: QueryClient,
  id: string,
  nextTask: Task,
  reSort = false,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const replace = (xs: Task[] | undefined) => {
    if (!xs) return xs
    const out = xs.map((t) => (t.id === id ? nextTask : t))
    if (reSort) sortTasks(out, today)
    return out
  }
  qc.setQueryData<Task[]>(taskKeys.top, dropHiddenFromTop(replace, today))
  qc.setQueryData<Task[]>(taskKeys.list, replace)
  return { prevTop, prevList }
}

// Bump today's progress by `minutes`, mirroring the server crediting the
// finished session, so the bar moves the instant the row settles.
async function bumpProgressDone(
  qc: QueryClient,
  minutes: number,
): Promise<ProgressTodayResult | undefined> {
  await qc.cancelQueries({ queryKey: progressTodayKey })
  const prevProgress = qc.getQueryData<ProgressTodayResult>(progressTodayKey)
  if (prevProgress) {
    qc.setQueryData<ProgressTodayResult>(progressTodayKey, {
      ...prevProgress,
      done: prevProgress.done + minutes,
    })
  }
  return prevProgress
}

async function optimisticComplete(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  const task = findTaskInCaches(qc, id)
  if (!task) return optimisticRemove(qc, id)

  const now = new Date()
  const transition = completeTaskTransition(task, now)

  if (transition.kind === 'advance-subtask') {
    // Mirror the server: if completing this subtask leaves the whole task
    // snoozed, bank the running timer so the chip stops ticking immediately.
    const next =
      task.timerStartedAt && isSnoozed(transition.nextTask)
        ? {
            ...transition.nextTask,
            timerStartedAt: null,
            timerAccumulatedSeconds: currentTimerSeconds(task, now),
          }
        : transition.nextTask
    return replaceTaskInCaches(qc, id, next)
  }

  // A repeating task never leaves the active lists — it comes back on its
  // next due date. Replace it with the rescheduled row (timer reset) and
  // re-sort with the shared comparator so it slides into its new slot in
  // place, instead of vanishing until the refetch lands.
  if (transition.kind === 'finish-and-reschedule') {
    const next: Task = {
      ...transition.nextTask,
      timerStartedAt: null,
      timerAccumulatedSeconds: 0,
    }
    const snap = await replaceTaskInCaches(qc, id, next, true)
    const prevProgress = await bumpProgressDone(qc, task.timeFrame ?? 0)
    return { ...snap, prevProgress }
  }

  // finish-and-delete: a one-shot task is done for good — drop it.
  const snap = await optimisticRemove(qc, id)
  const prevProgress = await bumpProgressDone(qc, task.timeFrame ?? 0)
  return { ...snap, prevProgress }
}

async function optimisticSnooze(
  qc: QueryClient,
  id: string,
  allSubtasks: boolean,
): Promise<OptimisticSnapshot> {
  const task = findTaskInCaches(qc, id)
  if (!task) return optimisticRemove(qc, id)

  const now = new Date()
  const transition = snoozeTaskTransition(task, allSubtasks, now)
  if (transition.scope === 'task') return optimisticRemove(qc, id)
  // Mirror the server: if snoozing this subtask leaves the whole task
  // snoozed, bank the running timer so the chip stops ticking immediately.
  const next =
    task.timerStartedAt && isSnoozed(transition.nextTask)
      ? {
          ...transition.nextTask,
          timerStartedAt: null,
          timerAccumulatedSeconds: currentTimerSeconds(task, now),
        }
      : transition.nextTask
  return replaceTaskInCaches(qc, id, next)
}

// Whole-task snooze for a batch (the "snooze this task and everything after
// it" action): stamp each targeted row an hour out, bank any running timer,
// and re-sort so they sink below the still-active tasks right away.
async function optimisticSnoozeMany(
  qc: QueryClient,
  ids: string[],
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const idSet = new Set(ids)
  const now = new Date()
  const snooze = new Date(now.getTime() + HOUR_MS).toISOString()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const apply = (xs: Task[] | undefined) => {
    if (!xs) return xs
    const out = xs.map((t) => {
      if (!idSet.has(t.id)) return t
      const banked = t.timerStartedAt
        ? {
            timerStartedAt: null,
            timerAccumulatedSeconds: currentTimerSeconds(t, now),
          }
        : {}
      return { ...t, snooze, ...banked, updatedAt: now }
    })
    sortTasks(out, today)
    return out
  }
  qc.setQueryData<Task[]>(taskKeys.top, apply)
  qc.setQueryData<Task[]>(taskKeys.list, apply)
  return { prevTop, prevList }
}

// userId borrowed from a cached task; '' fallback is harmless — onSettled refetch swaps in the real row.
function makeOptimisticTask(input: TaskInput, userId: string): Task {
  const now = new Date()
  return {
    id: `optimistic-${Math.random().toString(36).slice(2, 11)}`,
    userId,
    title: input.title,
    emoji: input.emoji,
    due: input.due,
    dueTime: input.dueTime,
    strictDeadline: input.strictDeadline,
    canDoEarly: input.canDoEarly,
    repeat: input.repeat,
    repeatInterval: input.repeatInterval,
    repeatUnit: input.repeatUnit,
    repeatWeekdays: input.repeatWeekdays,
    timeFrame: input.timeFrame,
    timekeeperId: input.timekeeperId ?? null,
    timeframeType: input.timeframeType ?? 'fixed',
    timerStartedAt: null,
    timerAccumulatedSeconds: 0,
    measurementCount: 0,
    snooze: null,
    tags: input.tags ?? [],
    subtasks: input.subtasks,
    createdAt: now,
    updatedAt: now,
  }
}

async function optimisticCreate(
  qc: QueryClient,
  input: TaskInput,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)

  const userId = prevTop?.[0]?.userId ?? prevList?.[0]?.userId ?? ''
  const optimistic = makeOptimisticTask(input, userId)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const insertSorted = (xs: Task[] | undefined) => {
    if (!xs) return xs
    const next = [...xs, optimistic]
    sortTasks(next, today)
    return next
  }
  qc.setQueryData<Task[]>(taskKeys.top, dropHiddenFromTop(insertSorted, today))
  qc.setQueryData<Task[]>(taskKeys.list, insertSorted)

  return { prevTop, prevList }
}

async function optimisticUpdate(
  qc: QueryClient,
  id: string,
  input: TaskInput,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const prevOne = qc.getQueryData<Task>(taskKeys.one(id))

  const existing = prevOne ?? findTaskInCaches(qc, id)
  if (!existing) return { prevTop, prevList, prevOne: { id, value: prevOne } }

  const next: Task = { ...existing, ...input, updatedAt: new Date() }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Sort-affecting fields (due, repeat, strictDeadline, timeFrame) may
  // have changed; just re-sort unconditionally — cheap vs the network rtt.
  const replaceSorted = (xs: Task[] | undefined) => {
    if (!xs) return xs
    const out = xs.map((t) => (t.id === id ? next : t))
    sortTasks(out, today)
    return out
  }
  qc.setQueryData<Task[]>(taskKeys.top, dropHiddenFromTop(replaceSorted, today))
  qc.setQueryData<Task[]>(taskKeys.list, replaceSorted)
  qc.setQueryData<Task>(taskKeys.one(id), next)

  return { prevTop, prevList, prevOne: { id, value: prevOne } }
}

function rollback(qc: QueryClient, snap: OptimisticSnapshot | undefined) {
  if (!snap) return
  if (snap.prevTop !== undefined) qc.setQueryData(taskKeys.top, snap.prevTop)
  if (snap.prevList !== undefined)
    qc.setQueryData(taskKeys.list, snap.prevList)
  if (snap.prevProgress !== undefined)
    qc.setQueryData(progressTodayKey, snap.prevProgress)
  if (snap.prevOne)
    qc.setQueryData(taskKeys.one(snap.prevOne.id), snap.prevOne.value)
}

// ----------------------------------------------------------------------

type EnabledOpts = { enabled?: boolean }

const BASELINE_SYNC_INTERVAL_MS = 10_000
const ACTIVE_SYNC_INTERVAL_MS = 3_000
const listSyncInterval = (data: Task[] | undefined): number =>
  data?.some((t) => t.timerStartedAt !== null)
    ? ACTIVE_SYNC_INTERVAL_MS
    : BASELINE_SYNC_INTERVAL_MS
const oneSyncInterval = (data: Task | undefined): number =>
  data?.timerStartedAt ? ACTIVE_SYNC_INTERVAL_MS : BASELINE_SYNC_INTERVAL_MS

// The authoritative cross-device Selected Task pointer. Polls aggressively —
// even on a backgrounded tab and always on focus, bypassing the default stale
// window — so every device converges on the current selection within ~3s.
export function useSelection() {
  const api = useApi()
  return useQuery({
    queryKey: selectionKey,
    queryFn: () => api.selection.get(),
    refetchInterval: ACTIVE_SYNC_INTERVAL_MS,
    refetchIntervalInBackground: true,
    // Cross-device convergence rides on the interval poll and the always-on
    // focus refetch, not on refetch-on-mount. Keeping data fresh for one poll
    // period stops a mount (e.g. navigating Home right after pressing Start)
    // from firing a GET that races the not-yet-committed start and overwrites
    // the optimistic pointer with a stale null.
    staleTime: ACTIVE_SYNC_INTERVAL_MS,
    refetchOnWindowFocus: 'always',
  })
}

type UnselectCtx = {
  prev?: SelectionResult
  completeId?: string
  // Snapshot for rolling back the optimistic auto-complete (row removal +
  // progress-bar bump) if the unselect itself fails.
  completeSnap?: OptimisticSnapshot
}

// Return: pause the Selected Task's timer and clear the pointer. Optimistically
// empties selection so the UI drops out of the Focus View immediately.
//
// Return pauses the timer, so it obeys the same rule as an explicit pause: a
// fixed task whose timer has reached its target auto-completes. We decide that
// up front (on the still-running task, which ticks live) and, after the server
// pause lands, complete it — mirroring the timer pause path.
export function useUnselect() {
  const qc = useQueryClient()
  const api = useApi()
  return useMutation<SelectionResult, Error, void, UnselectCtx>({
    mutationFn: () => api.selection.unselect(),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: selectionKey })
      const prev = qc.getQueryData<SelectionResult>(selectionKey)
      // Resolve child→keeper so the timer-bearing row is the one we test and
      // later complete. The Selected Task is rank-independent, so it may only
      // live in the one(id) cache — check that before the list/top caches.
      const getTask = (id: string) =>
        qc.getQueryData<Task>(taskKeys.one(id)) ?? findTaskInCaches(qc, id)
      const selectedId = prev?.selectedTaskId ?? null
      const selected = selectedId ? getTask(selectedId) : undefined
      const timerTask = selected?.timekeeperId
        ? getTask(selected.timekeeperId)
        : selected
      // Only a Return that actually pauses a *running* timer may auto-complete
      // — the same `wasRunning` guard the timer pause path applies. Without it,
      // a task snoozed past its target (time banked, timer already stopped)
      // would be silently completed by a later Return.
      const completeId =
        timerTask?.timerStartedAt &&
        shouldCompleteOnPause(timerTask, new Date())
          ? timerTask.id
          : undefined
      qc.setQueryData<SelectionResult>(selectionKey, { selectedTaskId: null })
      // Mirror the manual Done path: optimistically drop the row and bump
      // today's progress so the bar moves the instant we step off, instead of
      // lagging a refetch (or, before this, never updating on Return at all).
      const completeSnap = completeId
        ? await optimisticComplete(qc, completeId)
        : undefined
      return { prev, completeId, completeSnap }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(selectionKey, ctx.prev)
      if (ctx?.completeSnap) rollback(qc, ctx.completeSnap)
    },
    onSuccess: async (_res, _v, ctx) => {
      if (ctx?.completeId) await api.tasks.complete(ctx.completeId)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: selectionKey })
      // The Return also paused (and maybe completed) a task — refresh caches,
      // including today's progress so an auto-completed task credits the bar.
      invalidateTaskCaches(qc)
    },
  })
}

// Step out of the Focus View without the Return semantics — no timer pause,
// no auto-complete. Used after a complete/snooze has already taken the task
// out of the active list (the server clears its own pointer in the same
// transaction); this just drops the client pointer so the view exits the
// instant the action fires, instead of waiting on the ~3s selection poll.
export function useExitFocus() {
  const qc = useQueryClient()
  return () => {
    qc.setQueryData<SelectionResult>(selectionKey, { selectedTaskId: null })
    // Cancel a poll already in flight (it predates the server clearing the
    // pointer) so it can't restore the stale selection. revert:false keeps
    // the cancel from putting the old pointer back.
    void qc.cancelQueries({ queryKey: selectionKey }, { revert: false })
  }
}

export function useTopTasks(opts: EnabledOpts = {}) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.top,
    queryFn: () => api.tasks.listTop(),
    enabled: opts.enabled ?? true,
    refetchInterval: (q) => listSyncInterval(q.state.data),
  })
}

export function useAllTasks(opts: EnabledOpts = {}) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.list,
    queryFn: () => api.tasks.list(),
    enabled: opts.enabled ?? true,
    refetchInterval: (q) => listSyncInterval(q.state.data),
  })
}

export function useTask(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.one(id),
    queryFn: () => api.tasks.get(id),
    enabled: !!id,
    refetchInterval: (q) => oneSyncInterval(q.state.data),
  })
}

export function useHistory(date: string) {
  const api = useApi()
  return useQuery({
    queryKey: historyKey(date),
    queryFn: () => api.history.forDate(date),
  })
}

export function useProgressToday() {
  const api = useApi()
  return useQuery({
    queryKey: progressTodayKey,
    queryFn: () => api.progress.today(),
  })
}

export function useProgressRecap() {
  const api = useApi()
  return useQuery({
    queryKey: progressRecapKey,
    queryFn: () => api.progress.recap(),
    // Verdicts only change at day boundaries; an hour of staleness is fine.
    staleTime: HOUR_MS,
  })
}

export function useSettings() {
  const api = useApi()
  return useQuery({
    queryKey: settingsKey,
    queryFn: () => api.settings.get(),
  })
}

export function useUpdateSettings() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UserSettings) => api.settings.update(input),
    onSuccess: (saved) => {
      qc.setQueryData(settingsKey, saved)
      // The Daily Target and pacing both derive from settings.
      void qc.invalidateQueries({ queryKey: progressTodayKey })
    },
  })
}

export function useStats() {
  const api = useApi()
  return useQuery({
    queryKey: statsKey,
    queryFn: () => api.stats.get(),
    // Stats roll up the whole history; users expect them to reflect the
    // latest server state every time they open the page. The default
    // 5-min staleTime + persister means an old payload sticks around
    // across reloads, which hides server-side stats fixes.
    staleTime: 0,
    refetchOnMount: 'always',
  })
}

export function useCreateTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) => api.tasks.create(input),
    onMutate: (input) => optimisticCreate(qc, input),
    onError: (_e, _input, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useUpdateTask() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) =>
      api.tasks.update(id, input),
    onMutate: async ({ id, input }) => {
      const prevTask = findTaskInCaches(qc, id)
      const snap = await optimisticUpdate(qc, id, input)
      return { ...snap, prevTask }
    },
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSuccess: (_t, vars, ctx) => {
      const prev = ctx?.prevTask
      if (!prev) return
      undo.push({
        label: `Edited '${prev.title}'`,
        run: async () => {
          await api.tasks.update(vars.id, taskToInput(prev))
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useDeleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onMutate: async (id) => {
      const prevTask = findTaskInCaches(qc, id)
      const snap = await optimisticRemove(qc, id)
      return { ...snap, prevTask }
    },
    onError: (_e, _id, ctx) => rollback(qc, ctx),
    onSuccess: (_d, _id, ctx) => {
      const prev = ctx?.prevTask
      if (!prev) return
      undo.push({
        label: `Deleted '${prev.title}'`,
        run: async () => {
          await api.tasks.create(taskToInput(prev))
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export type CompleteVars = string | { id: string; countMeasurement?: boolean }

function normalizeComplete(v: CompleteVars): { id: string; countMeasurement?: boolean } {
  return typeof v === 'string' ? { id: v } : v
}

export function useCompleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: (vars: CompleteVars) => {
      const { id, countMeasurement } = normalizeComplete(vars)
      return api.tasks.complete(id, { countMeasurement })
    },
    onMutate: async (vars) => {
      const { id } = normalizeComplete(vars)
      const prevTask = findTaskInCaches(qc, id)
      const snap = await optimisticComplete(qc, id)
      return { ...snap, prevTask }
    },
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSuccess: (data, _vars, ctx) => {
      // Global undo: a full completion reverses server-side through its
      // history row — snapshot restored, row deleted, progress re-finalized.
      // Subtask advances (historyId null) are covered by the edit path.
      if (!data.historyId) return
      const historyId = data.historyId
      undo.push({
        label: `Done '${ctx?.prevTask?.title ?? 'task'}'`,
        run: async () => {
          await api.history.undo(historyId)
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useSnoozeTask() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: (vars: { id: string; allSubtasks?: boolean }) =>
      api.tasks.snooze(vars.id, vars.allSubtasks ?? false),
    onMutate: async (vars) => {
      const prevTask = findTaskInCaches(qc, vars.id)
      const snap = await optimisticSnooze(qc, vars.id, vars.allSubtasks ?? false)
      return { ...snap, prevTask }
    },
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSuccess: (_res, vars, ctx) => {
      undo.push({
        label: `Snoozed '${ctx?.prevTask?.title ?? 'task'}'`,
        run: async () => {
          await api.tasks.unsnooze(vars.id)
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

async function optimisticUnsnooze(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  const task = findTaskInCaches(qc, id)
  if (!task) return optimisticRemove(qc, id)
  const subtasks = task.subtasks.map((s) =>
    s.snooze ? { ...s, snooze: undefined } : s,
  )
  return replaceTaskInCaches(qc, id, { ...task, snooze: null, subtasks })
}

export function useUnsnoozeTask() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: (id: string) => api.tasks.unsnooze(id),
    onMutate: async (id) => {
      const prevTask = findTaskInCaches(qc, id)
      const snap = await optimisticUnsnooze(qc, id)
      return { ...snap, prevTask }
    },
    onError: (_e, _id, ctx) => rollback(qc, ctx),
    onSuccess: (_t, id, ctx) => {
      const prev = ctx?.prevTask
      if (!prev) return
      undo.push({
        label: `Woke '${prev.title}'`,
        run: async () => {
          await api.tasks.update(id, taskToInput(prev))
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useSnoozeManyTasks() {
  const api = useApi()
  const qc = useQueryClient()
  const undo = useUndo()
  return useMutation({
    mutationFn: (ids: string[]) => api.tasks.snoozeMany(ids),
    onMutate: (ids) => optimisticSnoozeMany(qc, ids),
    onError: (_e, _ids, ctx) => rollback(qc, ctx),
    onSuccess: (res, ids) => {
      undo.push({
        label: `Snoozed ${res.count} task${res.count === 1 ? '' : 's'}`,
        run: async () => {
          await Promise.all(ids.map((id) => api.tasks.unsnooze(id)))
          invalidateTaskCaches(qc)
        },
      })
    },
    onSettled: () => invalidateTaskCaches(qc),
  })
}

// Mutate a task's timer state. The id passed in may be a 0-time-frame
// child; the server resolves it to the effective task (keeper for
// children, self otherwise) and returns the actual updated row. We use
// that to patch both the keeper's `one`-cache and the lists so any UI
// rendering the keeper updates in lockstep.
//
// Optimistic update: best-effort. We look up the target ID client-side
// the same way the server does (child.timekeeperId ?? id) and apply the
// timer math locally so the timer-widget changes feel instant. If the
// cache doesn't have the task yet, we skip optimism and rely on the
// server response — the next refetch fills the gap.
function applyClientTimerAction(task: Task, action: TimerAction): Task {
  // Use the action's stamped `at` so optimistic math matches what the server will compute on replay.
  const now = action.at ? new Date(action.at) : new Date()
  // Coerce the persisted-cache string back into a Date, same trick the
  // timer-utils math uses. The cached row may carry an ISO string after
  // a localStorage rehydrate; treating it as a Date below would crash.
  const started =
    task.timerStartedAt instanceof Date
      ? task.timerStartedAt
      : task.timerStartedAt
        ? new Date(task.timerStartedAt)
        : null
  const next: Task = { ...task, timerStartedAt: started }
  switch (action.kind) {
    case 'start':
      if (!started) {
        next.timerStartedAt = now
      }
      // Starting a timer wakes a snoozed task (task-level or all-subtasks-
      // snoozed), matching the server. Optimistically clear the snooze so the
      // row reappears in the active list immediately.
      if (isSnoozed(next)) {
        next.snooze = null
        next.subtasks = next.subtasks.map((s) =>
          s.snooze ? { ...s, snooze: undefined } : s,
        )
      }
      break
    case 'pause':
      if (started) {
        const elapsed = (now.getTime() - started.getTime()) / 1000
        next.timerAccumulatedSeconds = Math.max(
          0,
          task.timerAccumulatedSeconds + elapsed,
        )
        next.timerStartedAt = null
      }
      break
    case 'add': {
      const current = started
        ? task.timerAccumulatedSeconds +
          (now.getTime() - started.getTime()) / 1000
        : task.timerAccumulatedSeconds
      const after = Math.max(0, current + action.seconds)
      if (started) {
        next.timerAccumulatedSeconds = after
        next.timerStartedAt = now
      } else {
        next.timerAccumulatedSeconds = after
        next.timerStartedAt = null
      }
      break
    }
    case 'reset':
      next.timerAccumulatedSeconds = 0
      next.timerStartedAt = null
      break
  }
  return next
}

// Stable mutation-key for the timer. Defaults registered against this
// key survive cache rehydration; paused/offline mutations re-run with
// the registered mutationFn even though the component that originally
// fired them is long gone.
export const timerMutationKey = ['tasks', 'timer'] as const

type TimerVars = { id: string; action: TimerAction }
type TimerCtx = {
  prevOne?: { id: string; value: Task | undefined }
  prevTop?: Task[]
  prevList?: Task[]
  prevSelection?: SelectionResult
  // Whether the timer was running before this action — so a pause that
  // actually stops a running timer (not a no-op re-pause) can trigger the
  // auto-complete below.
  wasRunning?: boolean
}

// Call once after the QueryClient and ApiClient exist (web: at client
// construction; mobile: inside MobileApiProvider). Re-registering is a
// no-op overwrite — safe for HMR / re-mounts.
export function registerTimerMutationDefaults(qc: QueryClient, api: ApiClient) {
  qc.setMutationDefaults(timerMutationKey, {
    networkMode: 'offlineFirst',
    mutationFn: (vars: TimerVars) => api.tasks.timer(vars.id, vars.action),
    onMutate: async (vars: TimerVars): Promise<TimerCtx> => {
      // Starting a timer selects that task server-side (the id acted on, not
      // the resolved keeper). Mirror it into the selection cache *before this
      // function's first await*: a caller may navigate Home the instant
      // mutate() returns, and only the synchronous prefix of onMutate has run
      // by then. Leaving the pointer stale until after an await lets the Focus
      // View mount, refetch, and race the not-yet-committed start.
      const prevSelection = qc.getQueryData<SelectionResult>(selectionKey)
      if (vars.action.kind === 'start') {
        qc.setQueryData<SelectionResult>(selectionKey, {
          selectedTaskId: vars.id,
        })
        // Drop a poll already in flight — it predates this start. revert:false
        // so cancelling can't restore the pointer we just overwrote.
        void qc.cancelQueries({ queryKey: selectionKey }, { revert: false })
      }

      await qc.cancelQueries({ queryKey: taskKeys.all })
      const issuer = findTaskInCaches(qc, vars.id)
      const targetId = issuer?.timekeeperId ?? vars.id
      const target = issuer?.timekeeperId
        ? findTaskInCaches(qc, targetId)
        : issuer
      const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
      const prevList = qc.getQueryData<Task[]>(taskKeys.list)
      const prevOne = target
        ? {
            id: targetId,
            value: qc.getQueryData<Task>(taskKeys.one(targetId)),
          }
        : undefined
      if (target) {
        const next = applyClientTimerAction(target, vars.action)
        qc.setQueryData<Task>(taskKeys.one(targetId), next)
        const patch = (xs: Task[] | undefined) =>
          xs?.map((t) => (t.id === targetId ? next : t))
        qc.setQueryData<Task[]>(taskKeys.top, patch)
        qc.setQueryData<Task[]>(taskKeys.list, patch)
      }
      return {
        prevOne,
        prevTop,
        prevList,
        prevSelection,
        wasRunning: target?.timerStartedAt != null,
      }
    },
    onSuccess: async (
      server: Task,
      vars: TimerVars,
      ctx: TimerCtx | undefined,
    ) => {
      qc.setQueryData<Task>(taskKeys.one(server.id), server)
      const patch = (xs: Task[] | undefined) =>
        xs?.map((t) => (t.id === server.id ? server : t))
      qc.setQueryData<Task[]>(taskKeys.top, patch)
      qc.setQueryData<Task[]>(taskKeys.list, patch)

      // The start has now actually committed the pointer server-side. Re-assert
      // it, cancelling any selection fetch still in flight — a GET issued
      // before the commit would otherwise land afterwards carrying the old
      // null pointer and knock the Focus View out from under the user.
      if (vars.action.kind === 'start') {
        await qc.cancelQueries({ queryKey: selectionKey }, { revert: false })
        qc.setQueryData<SelectionResult>(selectionKey, {
          selectedTaskId: vars.id,
        })
      }

      // Global undo for the destructive timer verbs. Start/pause are excluded
      // by design — pressing the button again IS the undo, and un-pausing
      // retroactively would falsify elapsed time.
      if (vars.action.kind === 'add') {
        const seconds = vars.action.seconds
        const m = Math.round(Math.abs(seconds) / 60)
        undoRef.current.push({
          label: seconds >= 0 ? `Timer +${m}m` : `Timer −${m}m`,
          run: async () => {
            await api.tasks.timer(vars.id, { kind: 'add', seconds: -seconds })
            invalidateTaskCaches(qc)
          },
        })
      } else if (vars.action.kind === 'reset') {
        const prev = ctx?.prevOne?.value
        const seconds = prev ? Math.round(currentTimerSeconds(prev, new Date())) : 0
        if (seconds > 0) {
          undoRef.current.push({
            label: 'Timer reset',
            run: async () => {
              await api.tasks.timer(vars.id, { kind: 'add', seconds })
              invalidateTaskCaches(qc)
            },
          })
        }
      }

      // Pausing a fixed-time-frame task once its timer has reached the target
      // is the "I'm done" signal — auto-complete it. Guard on wasRunning so a
      // no-op re-pause of an already-paused task doesn't re-fire completion.
      if (
        vars.action.kind === 'pause' &&
        ctx?.wasRunning &&
        shouldCompleteOnPause(server, new Date())
      ) {
        // Mirror the manual Done path: drop the row and bump today's progress
        // optimistically, so the bar moves the instant the timer auto-completes
        // rather than lagging the invalidate refetch below.
        await optimisticComplete(qc, server.id)
        // Pausing never unselects (CONTEXT.md): a repeating task advances in
        // place and STAYS selected, so the Focus View keeps showing it,
        // paused. Only a one-off — whose row the completion deletes — drops
        // the pointer (the server's FK clears its own).
        const repeats = server.repeat !== 'No Repeat'
        if (!repeats) {
          const selected =
            qc.getQueryData<SelectionResult>(selectionKey)?.selectedTaskId
          if (selected === vars.id || selected === server.id) {
            qc.setQueryData<SelectionResult>(selectionKey, {
              selectedTaskId: null,
            })
            void qc.cancelQueries({ queryKey: selectionKey }, { revert: false })
          }
        }
        try {
          await api.tasks.complete(server.id, { keepSelection: repeats })
        } finally {
          invalidateTaskCaches(qc)
        }
      }
    },
    onError: (_e: unknown, _vars: TimerVars, ctx: TimerCtx | undefined) => {
      if (!ctx) return
      if (ctx.prevOne) {
        qc.setQueryData<Task | undefined>(
          taskKeys.one(ctx.prevOne.id),
          ctx.prevOne.value,
        )
      }
      qc.setQueryData<Task[] | undefined>(taskKeys.top, ctx.prevTop)
      qc.setQueryData<Task[] | undefined>(taskKeys.list, ctx.prevList)
      if (ctx.prevSelection !== undefined) {
        qc.setQueryData<SelectionResult>(selectionKey, ctx.prevSelection)
      }
    },
  })
}

// Wraps mutate/mutateAsync so `at` is stamped on the variables BEFORE TanStack stores them in mutation.state.variables. Stamping inside onMutate would mutate that object in-place, which races with the PQCP serialiser if the process is killed in the gap between cache-add and onMutate.
export function useTaskTimer() {
  const mutation = useMutation<Task, Error, TimerVars, TimerCtx>({
    mutationKey: [...timerMutationKey],
  })
  return {
    ...mutation,
    mutate: (vars: TimerVars) => mutation.mutate(stampAt(vars)),
    mutateAsync: (vars: TimerVars) => mutation.mutateAsync(stampAt(vars)),
  }
}

function stampAt(vars: TimerVars): TimerVars {
  if (vars.action.at) return vars
  return {
    ...vars,
    action: { ...vars.action, at: new Date().toISOString() },
  }
}

// Debounced emoji suggestion from the TaskForm. Each call is a one-off
// Claude request — no cache, no optimistic state. Callers debounce on
// title-changes so we don't flood the API on every keystroke.
export function useSuggestEmojis() {
  const api = useApi()
  return useMutation({
    mutationFn: (title: string) => api.tasks.suggestEmojis(title),
  })
}

// Kick off a background fetch for a task's detail. Callers attach this
// to hover handlers so the data is in flight before the user navigates.
export function usePrefetchTask() {
  const qc = useQueryClient()
  const api = useApi()
  return (id: string) => {
    qc.prefetchQuery({
      queryKey: taskKeys.one(id),
      queryFn: () => api.tasks.get(id),
    })
  }
}

// Copy a list-cached task into taskKeys.one(id) so the detail page
// renders without waiting for a fetch. Idempotent — won't clobber a
// fresher server response if a prefetch already landed.
export function usePrimeTaskCache() {
  const qc = useQueryClient()
  return (task: Task) => {
    qc.setQueryData<Task>(taskKeys.one(task.id), (prev) => prev ?? task)
  }
}
