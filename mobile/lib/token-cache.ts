import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

// Was using expo-secure-store, but a Metro resolution bug in pnpm
// monorepos was preventing the package from loading. AsyncStorage is
// less secure (tokens aren't in the keychain) but the JWT is short-lived
// and refreshable, so the practical risk is small. Revisit if we ship
// to TestFlight / production.
export const tokenCache = {
  async getToken(key: string) {
    if (Platform.OS === 'web') return null
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  async saveToken(key: string, value: string) {
    if (Platform.OS === 'web') return
    try {
      await AsyncStorage.setItem(key, value)
    } catch {
      // ignore
    }
  },
}
