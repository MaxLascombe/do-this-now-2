import { AsyncLocalStorage } from 'node:async_hooks'

// Which lock-screen device (if any) originated the current request. The app
// sends its device token as X-Lockscreen-Device on every call once it can
// mirror state onto the Live Activity locally; syncLockScreen then treats
// that device as already having an activity and skips its push-to-start
// (a second start would duplicate the locally-started one). Update and end
// pushes still go — same content, no chime, and they clear `pending`.
export type LockScreenOrigin = { deviceToken?: string; deviceId?: string }

const store = new AsyncLocalStorage<LockScreenOrigin>()

export const runWithLockScreenOrigin = <T>(
  origin: LockScreenOrigin | null,
  fn: () => T,
): T => (origin ? store.run(origin, fn) : fn())

export const getLockScreenOrigin = (): LockScreenOrigin | null =>
  store.getStore() ?? null
