import { useAuth } from '@clerk/clerk-expo'
import { useCallback } from 'react'

import type { HistoryEntry, Task } from '@dtn/shared/schema'
import type { TaskInput } from './task-input'

const BASE_URL = process.env.EXPO_PUBLIC_API_URL!
if (!BASE_URL) {
  console.warn('EXPO_PUBLIC_API_URL not set; API calls will fail')
}

type FetchInit = Omit<RequestInit, 'body'> & { body?: unknown }

async function jsonFetch<T>(
  token: string | null,
  path: string,
  init: FetchInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${text}`)
  }
  return res.json() as Promise<T>
}

export type ProgressTodayResult = {
  done: number
  lives: number
  todo: number
  streak: number
  streakIsActive: boolean
  theoreticalMinimum: number
  daysUntilAllDone: number
  minutesToReduceTomorrowDays: number
}

export function useApi() {
  const { getToken } = useAuth()

  const call = useCallback(
    async <T,>(path: string, init?: FetchInit): Promise<T> => {
      const token = await getToken()
      return jsonFetch<T>(token, path, init)
    },
    [getToken],
  )

  return {
    listTasks: () => call<Task[]>('/api/tasks'),
    listTopTasks: () => call<Task[]>('/api/tasks/top'),
    getTask: (id: string) => call<Task>(`/api/tasks/${id}`),
    createTask: (input: TaskInput) =>
      call<Task>('/api/tasks', { method: 'POST', body: input }),
    updateTask: (id: string, input: TaskInput) =>
      call<Task>(`/api/tasks/${id}`, { method: 'PUT', body: input }),
    deleteTask: (id: string) =>
      call<{ ok: true }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    completeTask: (id: string) =>
      call<{ ok: true; advanced: boolean }>(
        `/api/tasks/${id}/complete`,
        { method: 'POST' },
      ),
    snoozeTask: (id: string, allSubtasks: boolean = false) =>
      call<{ ok: true; scope: 'subtask' | 'task' }>(
        `/api/tasks/${id}/snooze`,
        { method: 'POST', body: { allSubtasks } },
      ),
    getHistory: (date: string) =>
      call<HistoryEntry[]>(`/api/history/${date}`),
    getProgressToday: () =>
      call<ProgressTodayResult>('/api/progress/today'),
  }
}
