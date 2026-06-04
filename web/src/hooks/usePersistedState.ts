import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

// localStorage-backed state. The stored value is read in an effect (after
// mount), not in the useState initializer, so server and first client
// render both use `initial` — no hydration mismatch. The `loaded` guard
// keeps the initial value from overwriting the stored one on first render.
export function usePersistedState<T>(
  key: string,
  initial: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(initial)
  const loaded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) setState(JSON.parse(raw) as T)
    } catch {
      // unavailable or corrupt — keep the initial value
    }
  }, [key])

  useEffect(() => {
    if (!loaded.current) return
    try {
      window.localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // quota / unavailable — ignore
    }
  }, [key, state])

  // Registered after the write effect so it runs last on mount: the write
  // effect skips the initial render (loaded still false) and only persists
  // once the user actually changes the value.
  useEffect(() => {
    loaded.current = true
  }, [])

  return [state, setState]
}
