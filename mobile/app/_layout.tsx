import { ClerkProvider, useAuth, useClerk } from '@clerk/clerk-expo'
import { Feather } from '@expo/vector-icons'
import {
  Caveat_500Medium,
  Caveat_600SemiBold,
} from '@expo-google-fonts/caveat'
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono'
import { useFonts } from 'expo-font'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { Text, TextInput } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ErrorScreen } from '../components/ErrorScreen'
import { SignInScreen } from '../components/SignInScreen'
import { ToastProvider } from '../components/ToastProvider'
import { MobileApiAndQuery } from '../lib/api-client'
import { useLockScreenSync } from '../lib/lockscreen'
import { tokenCache } from '../lib/token-cache'

// expo-router renders this for any uncaught render error in the tree.
export function ErrorBoundary(props: ErrorBoundaryProps) {
  return <ErrorScreen {...props} />
}

// Hook host — must sit inside ClerkProvider to read the session.
function LockScreenSync() {
  useLockScreenSync()
  return null
}

// Clerk can report signed-out for a beat during token refreshes or flaky
// network; only overlay the sign-in screen when the signed-out state
// persists, so an authenticated session never flashes the login page.
function SignedOutOverlay() {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (!isLoaded || isSignedIn) {
      setShow(false)
      return
    }
    const timers: Array<ReturnType<typeof setTimeout>> = []
    timers.push(
      setTimeout(() => {
        // Signed-out with a session still in the client happens on app
        // resume: the active-session pointer drops but the session survives
        // (the sign-in buttons would just error "already signed in").
        // Reactivate it instead of showing the login page.
        const session =
          clerk.client?.activeSessions?.[0] ?? clerk.client?.sessions?.[0]
        if (session) {
          void clerk
            .setActive({ session: session.id })
            .catch(() => setShow(true))
          // If setActive hangs without settling or flipping isSignedIn,
          // fall back to the sign-in screen rather than hiding forever.
          timers.push(setTimeout(() => setShow(true), 5000))
          return
        }
        setShow(true)
      }, 900),
    )
    return () => timers.forEach(clearTimeout)
  }, [isLoaded, isSignedIn, clerk])
  if (!show) return null
  return <SignInScreen />
}

void SplashScreen.preventAutoHideAsync()

// Default to white text everywhere so we don't get black-on-black if a
// className doesn't apply for any reason.
const TextDefault = Text as unknown as { defaultProps?: { style?: object } }
TextDefault.defaultProps = TextDefault.defaultProps ?? {}
TextDefault.defaultProps.style = [
  { color: '#fff' },
  TextDefault.defaultProps.style,
]
const InputDefault = TextInput as unknown as {
  defaultProps?: { style?: object; placeholderTextColor?: string }
}
InputDefault.defaultProps = InputDefault.defaultProps ?? {}
InputDefault.defaultProps.style = [
  { color: '#fff' },
  InputDefault.defaultProps.style,
]
InputDefault.defaultProps.placeholderTextColor =
  InputDefault.defaultProps.placeholderTextColor ?? '#666'

// Mono is the default body font everywhere, matching web.
TextDefault.defaultProps.style = [
  { color: '#fff', fontFamily: 'JetBrainsMono_400Regular' },
  TextDefault.defaultProps.style,
]
InputDefault.defaultProps.style = [
  { color: '#fff', fontFamily: 'JetBrainsMono_400Regular' },
  InputDefault.defaultProps.style,
]

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!
if (!PUBLISHABLE_KEY) {
  throw new Error('EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY missing')
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ...Feather.font,
    Caveat_500Medium,
    Caveat_600SemiBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
    JetBrainsMono_700Bold,
  })

  useEffect(() => {
    if (!fontsLoaded) return
    const t = setTimeout(() => {
      void SplashScreen.hideAsync()
    }, 100)
    return () => clearTimeout(t)
  }, [fontsLoaded])

  if (!fontsLoaded) return null

  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <SafeAreaProvider>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
          <MobileApiAndQuery>
            <ToastProvider>
              <LockScreenSync />
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  contentStyle: { backgroundColor: '#000' },
                  headerStyle: { backgroundColor: '#000' },
                  headerTintColor: '#fff',
                  headerTitleStyle: { color: '#fff' },
                  headerBackButtonDisplayMode: 'minimal',
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="new-task"
                  options={{ presentation: 'modal', title: 'New task' }}
                />
                <Stack.Screen
                  name="tasks/[id]/edit"
                  options={{ presentation: 'modal', title: 'Edit task' }}
                />
                <Stack.Screen name="settings" options={{ title: 'Settings' }} />
              </Stack>
              {/* Overlay the sign-in screen on top when signed out. */}
              <SignedOutOverlay />
            </ToastProvider>
          </MobileApiAndQuery>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}
