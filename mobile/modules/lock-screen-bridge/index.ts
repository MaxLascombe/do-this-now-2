import { requireOptionalNativeModule } from 'expo'

// Null on Android and in builds without the native module (e.g. Expo Go) —
// callers feature-detect instead of crashing at import time.
type Subscription = { remove: () => void }

type LockScreenBridgeModule = {
  setConfig(baseUrl: string, deviceToken: string): void
  isSupported(): boolean
  addListener(
    event: 'onPushToStartToken',
    listener: (payload: { token: string }) => void,
  ): Subscription
  addListener(
    event: 'onActivityUpdateToken',
    listener: (payload: { token: string; activityId: string }) => void,
  ): Subscription
}

export default requireOptionalNativeModule<LockScreenBridgeModule>(
  'LockScreenBridge',
)
