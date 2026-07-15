import { useCallback, useState } from 'react'

// Drives a RefreshControl from a user pull only. Binding `refreshing` to a
// query's `isFetching` makes iOS animate the spinner in on every background
// poll — the screen jumps down each reload.
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }, [refetch])
  return { refreshing, onRefresh }
}
