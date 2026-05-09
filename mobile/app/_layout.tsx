import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  useOAuth,
  useSignIn,
  useUser,
} from '@clerk/clerk-expo'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { QueryProvider } from '../lib/query-client'
import { tokenCache } from '../lib/token-cache'
import { SignInScreen } from '../components/SignInScreen'

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
            <SignedIn>
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: '#000' },
                  headerStyle: { backgroundColor: '#000' },
                  headerTintColor: '#fff',
                  headerTitleStyle: { color: '#fff' },
                }}
              />
            </SignedIn>
            <SignedOut>
              <SignInScreen />
            </SignedOut>
          </QueryProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}

// Force-include hooks so tree-shaking doesn't drop them — Clerk Expo's
// useOAuth is needed by the SignInScreen later.
void useOAuth
void useSignIn
void useUser
