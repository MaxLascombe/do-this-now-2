import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
} from 'react'

import type { HistoryEntry, RecapDay, StatsResult, Task } from './types'
import type { TaskInput } from './task-input'
import type { UserSettings } from './settings'

// Structured error thrown by both web and mobile API adapters when the
// server returns a non-2xx. `code` matches the REST envelope shape from
// web/src/server/lib/http.ts (`'unauthenticated' | 'not_found' | 'invalid'`
// | future values). Consumers can branch on `err.code` instead of parsing
// a stringified message.
export class ApiError extends Error {
  code: string
  status: number
  details?: unknown
  constructor(opts: {
    code: string
    status: number
    message?: string
    details?: unknown
  }) {
    super(opts.message ?? opts.code)
    this.name = 'ApiError'
    this.code = opts.code
    this.status = opts.status
    this.details = opts.details
  }
}

// Parse a non-2xx response body back into a typed ApiError. The server uses a
// uniform { code, message?, details? } envelope; fall back to a generic
// 'http_error' carrying the HTTP statusText when the body isn't that JSON.
export function apiErrorFromResponse(
  status: number,
  statusText: string,
  rawBody: string,
): ApiError {
  let body: { code?: string; message?: string; details?: unknown } | null = null
  try {
    body = rawBody.length > 0 ? JSON.parse(rawBody) : null
  } catch {
    // not JSON; keep body null
  }
  return new ApiError({
    code: body?.code ?? 'http_error',
    status,
    message: body?.message ?? statusText,
    details: body?.details,
  })
}

export type ProgressTodayResult = {
  done: number
  lives: number
  todo: number
  streak: number
  streakIsActive: boolean
  bestStreak: number
  theoreticalMinimum: number
  daysUntilAllDone: number
  minutesToReduceTomorrowDays: number
  // The user's Workday window, echoed so every client paces with the same
  // settings the server targeted with — no separate settings fetch needed.
  workdayStartMin: number
  workdayEndMin: number
}

export type SelectionResult = { selectedTaskId: string | null }
export type CompleteTaskResult = { advanced: boolean }
export type CompleteTaskOptions = {
  countMeasurement?: boolean
  // Keep a surviving repeating row selected (the pause-at-target path).
  keepSelection?: boolean
}
export type SnoozeTaskResult = { scope: 'subtask' | 'task' }
export type SnoozeManyResult = { count: number }
export type DeleteTaskResult = Record<string, never>

export type TimerAction = (
  | { kind: 'start' }
  | { kind: 'pause' }
  | { kind: 'add'; seconds: number }
  | { kind: 'reset' }
) & { at?: string /* ISO client-click time */ }

export interface ApiClient {
  tasks: {
    list(): Promise<Task[]>
    listTop(): Promise<Task[]>
    get(id: string): Promise<Task>
    create(input: TaskInput): Promise<Task>
    update(id: string, input: TaskInput): Promise<Task>
    delete(id: string): Promise<DeleteTaskResult>
    complete(id: string, opts?: CompleteTaskOptions): Promise<CompleteTaskResult>
    snooze(id: string, allSubtasks?: boolean): Promise<SnoozeTaskResult>
    unsnooze(id: string): Promise<Task>
    snoozeMany(ids: string[]): Promise<SnoozeManyResult>
    suggestEmojis(title: string): Promise<string[]>
    // Returns the task whose row actually holds the timer state — for
    // 0-time-frame children that's the keeper, not the task you passed.
    timer(id: string, action: TimerAction): Promise<Task>
  }
  // The user's cross-device Selected Task. `get` is polled; `unselect`
  // (Return) pauses the selected task's timer and clears the pointer.
  selection: {
    get(): Promise<SelectionResult>
    unselect(): Promise<SelectionResult>
  }
  history: {
    forDate(date: string): Promise<HistoryEntry[]>
  }
  progress: {
    today(): Promise<ProgressTodayResult>
    recap(): Promise<RecapDay[]>
  }
  settings: {
    get(): Promise<UserSettings>
    update(input: UserSettings): Promise<UserSettings>
  }
  stats: {
    get(): Promise<StatsResult>
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
