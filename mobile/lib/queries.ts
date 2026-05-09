import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useApi } from './api'
import type { TaskInput } from './task-input'

const invalidateAll = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: ['progresstoday'] })
}

export function useTopTasks() {
  const api = useApi()
  return useQuery({
    queryKey: ['tasks', 'top'],
    queryFn: () => api.listTopTasks(),
  })
}

export function useAllTasks() {
  const api = useApi()
  return useQuery({
    queryKey: ['tasks', 'all'],
    queryFn: () => api.listTasks(),
  })
}

export function useTask(id: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['tasks', 'get', id],
    queryFn: () => api.getTask(id),
    enabled: !!id,
  })
}

export function useHistory(date: string) {
  const api = useApi()
  return useQuery({
    queryKey: ['history', date],
    queryFn: () => api.getHistory(date),
  })
}

export function useProgressToday() {
  const api = useApi()
  return useQuery({
    queryKey: ['progresstoday'],
    queryFn: () => api.getProgressToday(),
  })
}

export function useCreateTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TaskInput) => api.createTask(input),
    onSettled: () => invalidateAll(qc),
  })
}

export function useUpdateTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskInput }) =>
      api.updateTask(id, input),
    onSettled: () => invalidateAll(qc),
  })
}

export function useDeleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSettled: () => invalidateAll(qc),
  })
}

export function useCompleteTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.completeTask(id),
    onSettled: () => invalidateAll(qc),
  })
}

export function useSnoozeTask() {
  const api = useApi()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; allSubtasks?: boolean }) =>
      api.snoozeTask(vars.id, vars.allSubtasks ?? false),
    onSettled: () => invalidateAll(qc),
  })
}
