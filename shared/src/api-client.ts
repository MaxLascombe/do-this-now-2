import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react'

import type { HistoryEntry, Task } from './types'
import type { TaskInput } from './task-input'

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

export type CompleteTaskResult = { advanced: boolean }
export type SnoozeTaskResult = { scope: 'subtask' | 'task' }
export type DeleteTaskResult = Record<string, never>

export interface ApiClient {
  listTasks(): Promise<Task[]>
  listTopTasks(): Promise<Task[]>
  getTask(id: string): Promise<Task>
  createTask(input: TaskInput): Promise<Task>
  updateTask(id: string, input: TaskInput): Promise<Task>
  deleteTask(id: string): Promise<DeleteTaskResult>
  completeTask(id: string): Promise<CompleteTaskResult>
  snoozeTask(id: string, allSubtasks?: boolean): Promise<SnoozeTaskResult>
  getHistory(date: string): Promise<HistoryEntry[]>
  getProgressToday(): Promise<ProgressTodayResult>
}

const ApiContext = createContext<ApiClient | null>(null)

export function ApiProvider({
  value,
  children,
}: {
  value: ApiClient
  children: ReactNode
}) {
  return createElement(ApiContext.Provider, { value }, children)
}

export function useApi(): ApiClient {
  const api = useContext(ApiContext)
  if (!api) {
    throw new Error(
      '@dtn/shared: useApi() called outside <ApiProvider>. Wrap your app with <ApiProvider value={...}>.',
    )
  }
  return api
}
