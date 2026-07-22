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
import { UndoAffordances } from '../components/UndoAffordances'
import {
  getAuthFailureCount,
  MobileApiAndQuery,
  onAuthFailureCount,
} from '../lib/api-client'
import { NotificationPlanner } from '../components/NotificationPlanner'
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

// ADR-0007 (never sign-in on resume): the login screen has exactly two
// triggers — a client holding NO session at all (first launch, after an
// explicit sign-out), or the API answering unauthenticated repeatedly
// while no session is recoverable. Everything else — token refreshes,
// resume flickers, setActive retries — keeps the app rendered on cached
// data, indefinitely, like offline. There is NO timeout that flips to
// the login page: every previous incarnation of this overlay leaked
// through its timeout on slow networks.
const DEFINITIVE_AUTH_FAILURES = 3

function SignedOutOverlay() {
  const { isLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const [authFailures, setAuthFailuresState] = useState(getAuthFailureCount())
  useEffect(() => onAuthFailureCount(setAuthFailuresState), [])

  // While signed-out-with-a-session (the resume state), keep reactivating
  // in the background with backoff — quietly, forever.
  useEffect(() => {
    if (!isLoaded || isSignedIn) return
    let cancelled = false
    let delay = 800
    let timer: ReturnType<typeof setTimeout>
    const tryReactivate = () => {
      if (cancelled) return
      const session =
        clerk.client?.activeSessions?.[0] ?? clerk.client?.sessions?.[0]
      if (!session) return
      void clerk.setActive({ session: session.id }).catch(() => {
        delay = Math.min(delay * 2, 30_000)
        timer = setTimeout(tryReactivate, delay)
      })
    }
    timer = setTimeout(tryReactivate, delay)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isLoaded, isSignedIn, clerk])

  if (!isLoaded || isSignedIn) return null
  const hasAnySession =
    (clerk.client?.activeSessions?.length ?? 0) > 0 ||
    (clerk.client?.sessions?.length ?? 0) > 0
  const definitivelyOut =
    !hasAnySession || authFailures >= DEFINITIVE_AUTH_FAILURES
  if (!definitivelyOut) return null
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
              <NotificationPlanner />
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
              <UndoAffordances />
              {/* Overlay the sign-in screen on top when signed out. */}
              <SignedOutOverlay />
            </ToastProvider>
          </MobileApiAndQuery>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}
