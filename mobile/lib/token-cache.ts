import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Stores the Clerk session token in the device keychain (iOS) / encrypted
// shared prefs (Android). Falls back to no-op on web (where Clerk uses its
// own browser-side storage anyway).
export const tokenCache = {
  async getToken(key: string) {
    if (Platform.OS === 'web') return null
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async saveToken(key: string, value: string) {
    if (Platform.OS === 'web') return
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // ignore
    }
  },
}
