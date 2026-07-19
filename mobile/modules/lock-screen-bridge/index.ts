import { requireOptionalNativeModule } from 'expo'

// Null on Android and in builds without the native module (e.g. Expo Go) —
// callers feature-detect instead of crashing at import time. Push-token
// registration is native (launch-driven, see LockScreenTokenSync); JS only
// provisions credentials and kicks a sync.
type LockScreenBridgeModule = {
  setConfig(baseUrl: string, deviceToken: string): void
  isSupported(): boolean
  startSync(): void
  // Absent on builds older than the native method — feature-detect.
  endAllActivities?: () => Promise<void>
}

export default requireOptionalNativeModule<LockScreenBridgeModule>(
  'LockScreenBridge',
)
