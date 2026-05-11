import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

import type { ProgressTodayResult } from './api-client'
import { useApi } from './api-client'
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

async function optimisticComplete(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  // Read timeFrame BEFORE optimisticRemove drops the task from the caches.
  const task = findTaskInCaches(qc, id)
  const snap = await optimisticRemove(qc, id)
  await qc.cancelQueries({ queryKey: progressTodayKey })
  const prevProgress = qc.getQueryData<ProgressTodayResult>(progressTodayKey)
  if (task && prevProgress) {
    qc.setQueryData<ProgressTodayResult>(progressTodayKey, {
      ...prevProgress,
      done: prevProgress.done + (task.timeFrame ?? 0),
    })
  }
  return { ...snap, prevProgress }
}

function rollback(qc: QueryClient, snap: OptimisticSnapshot | undefined) {
  if (!snap) return
  if (snap.prevTop !== undefined) qc.setQueryData(taskKeys.top, snap.prevTop)
  if (snap.prevList !== undefined)
    qc.setQueryData(taskKeys.list, snap.prevList)
  if (snap.prevProgress !== undefined)
    qc.setQueryData(progressTodayKey, snap.prevProgress)
}

// ----------------------------------------------------------------------

type EnabledOpts = { enabled?: boolean }

export function useTopTasks(opts: EnabledOpts = {}) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.top,
    queryFn: () => api.tasks.listTop(),
    enabled: opts.enabled ?? true,
  })
}

export function useAllTasks(opts: EnabledOpts = {}) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.list,
    queryFn: () => api.tasks.list(),
    enabled: opts.enabled ?? true,
  })
}

export function useTask(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.one(id),
    queryFn: () => api.tasks.get(id),
    enabled: !!id,
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

export function useCreateTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) => api.tasks.create(input),
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useUpdateTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) =>
      api.tasks.update(id, input),
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

export function useCompleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.tasks.complete(id),
    onMutate: (id) => optimisticComplete(qc, id),
    onError: (_e, _id, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateTaskCaches(qc),
  })
}

export function useSnoozeTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; allSubtasks?: boolean }) =>
      api.tasks.snooze(vars.id, vars.allSubtasks ?? false),
    onMutate: (vars) => optimisticRemove(qc, vars.id),
    onError: (_e, _vars, ctx) => rollback(qc, ctx),
    onSettled: () => invalidateTaskCaches(qc),
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
