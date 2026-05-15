import { registerTimerMutationDefaults } from '@dtn/shared/queries'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { type ReactNode, useState } from 'react'

import { webApiClient } from './api-client'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,
          gcTime: ONE_DAY_MS,
        },
      },
    })
    // Register before PQCP rehydrates so resumePausedMutations finds the mutationFn.
    registerTimerMutationDefaults(qc, webApiClient)
    return qc
  })

  const persister =
    typeof window === 'undefined'
      ? undefined
      : createSyncStoragePersister({ storage: window.localStorage })

  if (!persister) {
    // SSR: no persistence; just render with a plain provider via PersistProvider
    // (it falls back gracefully when persister is undefined)
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: undefinedSafe }}
      >
        {children}
      </PersistQueryClientProvider>
    )
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_DAY_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}

// Stub persister used during SSR to satisfy the type.
const undefinedSafe = {
  persistClient: async () => {},
  restoreClient: async () => undefined,
  removeClient: async () => {},
}
