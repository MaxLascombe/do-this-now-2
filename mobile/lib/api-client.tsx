import { useAuth } from '@clerk/clerk-expo'
import {
  apiErrorFromResponse,
  type CompleteTaskResult,
  ApiProvider,
  type ApiClient,
  type SelectionResult,
} from '@dtn/shared/api-client'
import { getTzOffsetMin } from '@dtn/shared/time'
import { UndoProvider } from '@dtn/shared/undo'
import type { UserSettings } from '@dtn/shared/settings'
import type { HistoryEntry, StatsResult, Task } from '@dtn/shared/types'
import { type ReactNode, useMemo } from 'react'

import { getLockScreenDeviceToken } from './lockscreen'
import { QueryProvider } from './query-client'

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
  // Identifies this phone as the action's origin so the server skips its
  // push-to-start (the app mirrors the Live Activity locally).
  const originDevice = getLockScreenDeviceToken()
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // Send the client's local TZ on every request so the server can bracket
      // "today" / day boundaries correctly without each route accepting it as
      // a separate parameter.
      'X-Tz-Offset': String(getTzOffsetMin()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(originDevice ? { 'X-Lockscreen-Device': originDevice } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    throw apiErrorFromResponse(res.status, res.statusText, await res.text())
  }
  return res.json() as Promise<T>
}

function createMobileApi(getToken: () => Promise<string | null>): ApiClient {
  const call = async <T,>(path: string, init?: FetchInit): Promise<T> => {
    const token = await getToken()
    return jsonFetch<T>(token, path, init)
  }

  return {
    tasks: {
      list: () => call<Task[]>('/api/tasks'),
      listTop: () => call<Task[]>('/api/tasks?sort=top'),
      get: (id) => call<Task>(`/api/tasks/${id}`),
      create: (input) =>
        call<Task>('/api/tasks', { method: 'POST', body: input }),
      update: (id, input) =>
        call<Task>(`/api/tasks/${id}`, { method: 'PUT', body: input }),
      delete: (id) =>
        call<Record<string, never>>(`/api/tasks/${id}`, { method: 'DELETE' }),
      complete: (id, opts) =>
        call<CompleteTaskResult>(`/api/tasks/${id}/complete`, {
          method: 'POST',
          body: {
            countMeasurement: opts?.countMeasurement ?? true,
            keepSelection: opts?.keepSelection ?? false,
          },
        }),
      snooze: (id, allSubtasks = false) =>
        call<{ scope: 'subtask' | 'task' }>(`/api/tasks/${id}/snooze`, {
          method: 'POST',
          body: { allSubtasks },
        }),
      unsnooze: (id) =>
        call<Task>(`/api/tasks/${id}/unsnooze`, { method: 'POST' }),
      snoozeMany: (ids) =>
        call<{ count: number }>('/api/tasks/snooze-many', {
          method: 'POST',
          body: { ids },
        }),
      suggestEmojis: (title) =>
        call<string[]>('/api/tasks/suggest-emojis', {
          method: 'POST',
          body: { title },
        }),
      timer: (id, action) =>
        call<Task>(`/api/tasks/${id}/timer`, {
          method: 'POST',
          body: action,
        }),
    },
    selection: {
      get: () => call<SelectionResult>('/api/selection'),
      unselect: () =>
        call<SelectionResult>('/api/selection', { method: 'DELETE' }),
    },
    history: {
      forDate: (date) => call<HistoryEntry[]>(`/api/history/${date}`),
      undo: (historyId) =>
        call<Task>(`/api/history/${historyId}/undo`, { method: 'POST' }),
    },
    progress: {
      today: () => call(`/api/progress/today`),
      recap: () => call(`/api/progress/recap`),
    },
    settings: {
      get: () => call<UserSettings>('/api/settings'),
      update: (input) =>
        call<UserSettings>('/api/settings', { method: 'PUT', body: input }),
    },
    stats: {
      get: () => call<StatsResult>(`/api/stats`),
    },
  }
}

export function MobileApiAndQuery({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const api = useMemo(() => createMobileApi(getToken), [getToken])
  return (
    <QueryProvider api={api}>
      <ApiProvider value={api}>
        <UndoProvider>{children}</UndoProvider>
      </ApiProvider>
    </QueryProvider>
  )
}
