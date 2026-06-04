import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

// State backed by AsyncStorage. The stored value is read asynchronously on
// mount; writes happen only after the user changes the value. The `dirty`
// ref tracks user changes so (a) an in-flight read can't clobber a value the
// user already changed, and (b) the read itself doesn't trigger a write-back.
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial)
  const dirty = useRef(false)

  const set = useCallback<Dispatch<SetStateAction<T>>>((value) => {
    dirty.current = true
    setState(value)
  }, [])

  useEffect(() => {
    let cancelled = false
    void AsyncStorage.getItem(key).then((raw) => {
      if (cancelled || dirty.current || raw === null) return
      try {
        setState(JSON.parse(raw) as T)
      } catch {
        // corrupt value — keep the initial
      }
    })
    return () => {
      cancelled = true
    }
  }, [key])

  useEffect(() => {
    if (dirty.current) void AsyncStorage.setItem(key, JSON.stringify(state))
  }, [key, state])

  return [state, set]
}
