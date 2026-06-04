import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef, useState } from 'react'

// State backed by AsyncStorage. Reads once on mount; writes on change.
// The `loaded` guard prevents the initial value from overwriting a stored
// one before the async read resolves.
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initial)
  const loaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(key).then((raw) => {
      if (!cancelled && raw !== null) {
        try {
          setState(JSON.parse(raw) as T)
        } catch {
          // corrupt value — fall back to the initial
        }
      }
      loaded.current = true
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (loaded.current) void AsyncStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, setState]
}
