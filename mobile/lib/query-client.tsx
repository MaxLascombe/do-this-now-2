import type { ApiClient } from '@dtn/shared/api-client'
import { registerTimerMutationDefaults } from '@dtn/shared/queries'
import { DAY_MS } from '@dtn/shared/time'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { type ReactNode, useState } from 'react'

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
    // Sync registration so PQCP's restore-then-resume finds the mutationFn.
    registerTimerMutationDefaults(qc, api)
    return qc
  })
  const [persister] = useState(() =>
    createAsyncStoragePersister({ storage: AsyncStorage }),
  )

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: DAY_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
