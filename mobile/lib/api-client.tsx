import { useAuth } from '@clerk/clerk-expo'
import {
  ApiError,
  ApiProvider,
  type ApiClient,
} from '@dtn/shared/api-client'
import { getTzOffsetMin } from '@dtn/shared/time'
import type { HistoryEntry, Task } from '@dtn/shared/types'
import { type ReactNode, useMemo } from 'react'

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
      // Send the client's local TZ on every request so the server can bracket
      // "today" / day boundaries correctly without each route accepting it as
      // a separate parameter.
      'X-Tz-Offset': String(getTzOffsetMin()),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) {
    // Server uses the uniform { code, message?, details? } envelope. Parse
    // it back into a typed ApiError so consumers can branch on err.code.
    // Fall back to a generic 'http_error' if the body wasn't JSON.
    const text = await res.text()
    let body: { code?: string; message?: string; details?: unknown } | null = null
    try {
      body = text.length > 0 ? JSON.parse(text) : null
    } catch {
      // not JSON; keep body null
    }
    throw new ApiError({
      code: body?.code ?? 'http_error',
      status: res.status,
      message: body?.message ?? res.statusText,
      details: body?.details,
    })
  }
  return res.json() as Promise<T>
}

function createMobileApi(
  getToken: () => Promise<string | null>,
): ApiClient {
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
      complete: (id) =>
        call<{ advanced: boolean }>(`/api/tasks/${id}/complete`, {
          method: 'POST',
        }),
      snooze: (id, allSubtasks = false) =>
        call<{ scope: 'subtask' | 'task' }>(`/api/tasks/${id}/snooze`, {
          method: 'POST',
          body: { allSubtasks },
        }),
      suggestEmojis: (title) =>
        call<string[]>('/api/tasks/suggest-emojis', {
          method: 'POST',
          body: { title },
        }),
    },
    history: {
      forDate: (date) => call<HistoryEntry[]>(`/api/history/${date}`),
    },
    progress: {
      today: () => call(`/api/progress/today`),
    },
  }
}

export function MobileApiProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth()
  const api = useMemo(() => createMobileApi(getToken), [getToken])
  return <ApiProvider value={api}>{children}</ApiProvider>
}
