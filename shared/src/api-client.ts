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
  tasks: {
    list(): Promise<Task[]>
    listTop(): Promise<Task[]>
    get(id: string): Promise<Task>
    create(input: TaskInput): Promise<Task>
    update(id: string, input: TaskInput): Promise<Task>
    delete(id: string): Promise<DeleteTaskResult>
    complete(id: string): Promise<CompleteTaskResult>
    snooze(id: string, allSubtasks?: boolean): Promise<SnoozeTaskResult>
  }
  history: {
    forDate(date: string): Promise<HistoryEntry[]>
  }
  progress: {
    today(): Promise<ProgressTodayResult>
  }
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
