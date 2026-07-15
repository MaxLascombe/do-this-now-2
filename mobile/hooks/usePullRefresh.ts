import { useCallback, useState } from 'react'

// Drives a RefreshControl from an actual user pull only.
//
// Binding `refreshing` to a query's `isFetching` looks right but isn't: the
// queries poll in the background every few seconds, so `isFetching` flips true
// on every poll, and iOS then animates the refresh spinner into view — the
// whole screen jumps down and snaps back on each reload. Track a local flag
// that we set only when the user pulls, and clear when that refetch settles.
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false)
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    refetch().finally(() => setRefreshing(false))
  }, [refetch])
  return { refreshing, onRefresh }
}
