import { ClerkProvider, SignedOut } from '@clerk/clerk-expo'
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif'
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { Text, TextInput } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { SignInScreen } from '../components/SignInScreen'
import { MobileApiProvider } from '../lib/api-client'
import { QueryProvider } from '../lib/query-client'
import { tokenCache } from '../lib/token-cache'

import '../global.css'

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
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
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
          <QueryProvider>
            <MobileApiProvider>
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
              </Stack>
              {/* Overlay the sign-in screen on top when signed out. */}
              <SignedOut>
                <SignInScreen />
              </SignedOut>
            </MobileApiProvider>
          </QueryProvider>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </ClerkProvider>
  )
}
