import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import type { ProgressTodayResult, TimerAction } from './api-client'
import { useApi } from './api-client'
import { sortTasks } from './task-sorting'
import {
  completeTaskTransition,
  snoozeTaskTransition,
} from './task-transitions'
import type { TaskInput } from './task-input'
import type { Task } from './types'

export const taskKeys = {
  all: ['tasks'] as const,
  top: ['tasks', 'top'] as const,
  list: ['tasks', 'all'] as const,
  one: (id: string) => ['tasks', 'get', id] as const,
}
export const historyKey = (date: string) => ['history', date] as const
export const progressTodayKey = ['progresstoday'] as const
export const statsKey = ['stats'] as const

export const invalidateTaskCaches = (qc: QueryClient) => {
  // Prefix-match: invalidates taskKeys.top, taskKeys.list, and every
  // taskKeys.one(id) in one call.
  qc.invalidateQueries({ queryKey: taskKeys.all })
  qc.invalidateQueries({ queryKey: progressTodayKey })
}

// Optimistic helpers ----------------------------------------------------
// Each of complete/snooze/delete reads as "remove this task from the
// active lists right now". Repeating tasks will reappear with a future
// due date once the refetch lands (onSettled invalidates); snoozed/
// completed/deleted tasks won't.
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

async function replaceTaskInCaches(
  qc: QueryClient,
  id: string,
  nextTask: Task,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const replace = (xs: Task[] | undefined) =>
    xs?.map((t) => (t.id === id ? nextTask : t))
  qc.setQueryData<Task[]>(taskKeys.top, replace)
  qc.setQueryData<Task[]>(taskKeys.list, replace)
  return { prevTop, prevList }
}

async function optimisticComplete(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  const task = findTaskInCaches(qc, id)
  if (!task) return optimisticRemove(qc, id)

  const transition = completeTaskTransition(task, new Date())

  if (transition.kind === 'advance-subtask') {
    return replaceTaskInCaches(qc, id, transition.nextTask)
  }

  // Both finish-and-delete and finish-and-reschedule drop the task off
  // the active lists immediately (the rescheduled task reappears on the
  // refetch with a future due date) and bump progressToday.done so the
  // bar advances at the same instant the row vanishes.
  const snap = await optimisticRemove(qc, id)
  await qc.cancelQueries({ queryKey: progressTodayKey })
  const prevProgress = qc.getQueryData<ProgressTodayResult>(progressTodayKey)
  if (prevProgress) {
    qc.setQueryData<ProgressTodayResult>(progressTodayKey, {
      ...prevProgress,
      done: prevProgress.done + (task.timeFrame ?? 0),
    })
  }
  return { ...snap, prevProgress }
}

async function optimisticSnooze(
  qc: QueryClient,
  id: string,
  allSubtasks: boolean,
): Promise<OptimisticSnapshot> {
  const task = findTaskInCaches(qc, id)
  if (!task) return optimisticRemove(qc, id)

  const transition = snoozeTaskTransition(task, allSubtasks, new Date())
  if (transition.scope === 'task') return optimisticRemove(qc, id)
  return replaceTaskInCaches(qc, id, transition.nextTask)
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
  qc.setQueryData<Task[]>(taskKeys.top, insertSorted)
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
  qc.setQueryData<Task[]>(taskKeys.top, replaceSorted)
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
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) =>
      api.tasks.update(id, input),
    onMutate: ({ id, input }) => optimisticUpdate(qc, id, input),
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useDeleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.tasks.delete(id),
    onMutate: (id) => optimisticRemove(qc, id),
    onError: (_e, _id, ctx) => rollback(qc, ctx),
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
  return useMutation({
    mutationFn: (vars: CompleteVars) => {
      const { id, countMeasurement } = normalizeComplete(vars)
      return api.tasks.complete(id, { countMeasurement })
    },
    onMutate: (vars) => optimisticComplete(qc, normalizeComplete(vars).id),
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useSnoozeTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; allSubtasks?: boolean }) =>
      api.tasks.snooze(vars.id, vars.allSubtasks ?? false),
    onMutate: (vars) => optimisticSnooze(qc, vars.id, vars.allSubtasks ?? false),
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
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

export function useTaskTimer() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; action: TimerAction }) =>
      api.tasks.timer(vars.id, vars.action),
    onMutate: async (vars) => {
      // Stamp in onMutate (not the call site) so paused/replayed mutations carry the original click time, not the time they happened to be retried.
      if (!vars.action.at) {
        vars.action = { ...vars.action, at: new Date().toISOString() }
      }
      await qc.cancelQueries({ queryKey: taskKeys.all })
      const issuer = findTaskInCaches(qc, vars.id)
      // Resolve client-side the same way the server does: a child task
      // points at its keeper; standalone tasks hold their own timer.
      const targetId = issuer?.timekeeperId ?? vars.id
      const target = issuer?.timekeeperId
        ? findTaskInCaches(qc, targetId)
        : issuer
      if (!target) return undefined
      const next = applyClientTimerAction(target, vars.action)
      const prevOne = {
        id: targetId,
        value: qc.getQueryData<Task>(taskKeys.one(targetId)),
      }
      const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
      const prevList = qc.getQueryData<Task[]>(taskKeys.list)
      qc.setQueryData<Task>(taskKeys.one(targetId), next)
      const patch = (xs: Task[] | undefined) =>
        xs?.map((t) => (t.id === targetId ? next : t))
      qc.setQueryData<Task[]>(taskKeys.top, patch)
      qc.setQueryData<Task[]>(taskKeys.list, patch)
      return { prevOne, prevTop, prevList }
    },
    onSuccess: (server) => {
      // Server response is authoritative — replace the optimistic copy.
      qc.setQueryData<Task>(taskKeys.one(server.id), server)
      const patch = (xs: Task[] | undefined) =>
        xs?.map((t) => (t.id === server.id ? server : t))
      qc.setQueryData<Task[]>(taskKeys.top, patch)
      qc.setQueryData<Task[]>(taskKeys.list, patch)
    },
    onError: (_e, _vars, ctx) => {
      if (!ctx) return
      if (ctx.prevOne) {
        qc.setQueryData<Task | undefined>(
          taskKeys.one(ctx.prevOne.id),
          ctx.prevOne.value,
        )
      }
      qc.setQueryData<Task[] | undefined>(taskKeys.top, ctx.prevTop)
      qc.setQueryData<Task[] | undefined>(taskKeys.list, ctx.prevList)
    },
  })
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
