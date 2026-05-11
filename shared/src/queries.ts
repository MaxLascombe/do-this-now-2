import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'

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
  qc.invalidateQueries({ queryKey: taskKeys.all })
  qc.invalidateQueries({ queryKey: progressTodayKey })
}

// Optimistic helpers ----------------------------------------------------
// Each of complete/snooze/delete reads as "remove this task from the
// active lists right now". Repeating tasks will reappear with a future
// due date once the refetch lands (onSettled invalidates); snoozed/
// completed/deleted tasks won't.

type OptimisticSnapshot = {
  prevTop: Task[] | undefined
  prevList: Task[] | undefined
}

async function optimisticRemove(
  qc: QueryClient,
  id: string,
): Promise<OptimisticSnapshot> {
  await qc.cancelQueries({ queryKey: taskKeys.all })
  const prevTop = qc.getQueryData<Task[]>(taskKeys.top)
  const prevList = qc.getQueryData<Task[]>(taskKeys.list)
  const remove = (xs: Task[] | undefined) =>
    xs?.filter((t) => t.id !== id)
  qc.setQueryData<Task[]>(taskKeys.top, remove)
  qc.setQueryData<Task[]>(taskKeys.list, remove)
  return { prevTop, prevList }
}

function rollback(qc: QueryClient, snap: OptimisticSnapshot | undefined) {
  if (!snap) return
  if (snap.prevTop !== undefined) qc.setQueryData(taskKeys.top, snap.prevTop)
  if (snap.prevList !== undefined)
    qc.setQueryData(taskKeys.list, snap.prevList)
}

// ----------------------------------------------------------------------

export function useTopTasks() {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.top,
    queryFn: () => api.tasks.listTop(),
  })
}

export function useAllTasks() {
  const api = useApi()
  return useQuery({
    queryKey: taskKeys.list,
    queryFn: () => api.tasks.list(),
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
    onMutate: (id) => optimisticRemove(qc, id),
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
