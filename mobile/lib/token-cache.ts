import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Clerk Expo's recommended token cache, persisted via expo-secure-store on
// native and a no-op on web (Expo Router can build for web too, though we
// don't ship it).
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
