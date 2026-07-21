import type { ApiClient } from '@dtn/shared/api-client'
import {
  registerOfflineMutationDefaults,
  registerTimerMutationDefaults,
} from '@dtn/shared/queries'
import { DAY_MS } from '@dtn/shared/time'
import NetInfo from '@react-native-community/netinfo'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { onlineManager, QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { type ReactNode, useState } from 'react'

// Offline support (feature 10, 2026-07-21 plan): React Query pauses
// mutations while offline and resumes them on reconnect — but only if it
// KNOWS the network state, which React Native doesn't report by itself.
// Feed the onlineManager from NetInfo.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
)

export function QueryProvider({
  api,
  children,
}: {
  api: ApiClient
  children: ReactNode
}) {
  const [queryClient] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 5 * 60 * 1000, gcTime: DAY_MS },
      },
    })
    // Sync registration so PQCP's restore-then-resume finds the mutationFns
    // — the timer's and, for the offline queue, every task mutation's.
    registerTimerMutationDefaults(qc, api)
    registerOfflineMutationDefaults(qc, api)
    return qc
  })
  const [persister] = useState(() =>
    createAsyncStoragePersister({ storage: AsyncStorage }),
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: DAY_MS }}
      onSuccess={() => {
        // Replay whatever was queued when the app last died offline.
        void queryClient.resumePausedMutations()
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
