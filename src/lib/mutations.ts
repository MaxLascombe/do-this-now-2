import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  completeTask,
  getHistoryForDate,
  snoozeTask,
} from '../server/actions'
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTask,
  getTopTasks,
  updateTask,
} from '../server/tasks'
import { getTzOffsetMin } from './time'

const invalidateTasks = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: ['tasks'] })
  qc.invalidateQueries({ queryKey: ['progresstoday'] })
}

export const useTopTasks = () => {
  return {
    queryKey: ['tasks', 'top'] as const,
    queryFn: () => getTopTasks({ data: { tzOffsetMin: getTzOffsetMin() } }),
  }
}

export const useAllTasks = () => ({
  queryKey: ['tasks', 'all'] as const,
  queryFn: () => getAllTasks(),
})

export const useGetTaskOpts = (id: string) => ({
  queryKey: ['tasks', 'get', id] as const,
  queryFn: () => getTask({ data: { id } }),
  enabled: !!id,
})

export const useHistoryOpts = (date: string) => ({
  queryKey: ['history', date] as const,
  queryFn: () =>
    getHistoryForDate({ data: { date, tzOffsetMin: getTzOffsetMin() } }),
})

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof createTask>[0]['data']) =>
      createTask({ data }),
    onSettled: () => invalidateTasks(qc),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof updateTask>[0]['data']) =>
      updateTask({ data }),
    onSettled: () => invalidateTasks(qc),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSettled: () => invalidateTasks(qc),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => completeTask({ data: { id } }),
    onSettled: () => invalidateTasks(qc),
  })
}

export function useSnoozeTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; allSubtasks?: boolean }) =>
      snoozeTask({ data: vars }),
    onSettled: () => invalidateTasks(qc),
  })
}
