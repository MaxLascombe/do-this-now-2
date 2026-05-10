import { ClerkProvider, SignedOut } from '@clerk/clerk-expo'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SignInScreen } from '../components/SignInScreen'
import { QueryProvider } from '../lib/query-client'
import { tokenCache } from '../lib/token-cache'

import '../global.css'

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!
if (!PUBLISHABLE_KEY) {
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing')
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
          <QueryProvider>
            <StatusBar style="light" />
            {/* Stack must always be mounted so expo-router can match routes. */}
            <Stack
              screenOptions={{
                contentStyle: { backgroundColor: '#000' },
                headerStyle: { backgroundColor: '#000' },
                headerTintColor: '#fff',
                headerTitleStyle: { color: '#fff' },
              }}
            />
            {/* Overlay the sign-in screen on top when signed out. */}
            <SignedOut>
              <SignInScreen />
            </SignedOut>
          </QueryProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}
