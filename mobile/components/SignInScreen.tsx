import { useSignIn } from '@clerk/clerk-expo'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const canSubmit = !loading && email.length > 0 && password.length > 0

  const onSignIn = async () => {
    if (!isLoaded || !canSubmit) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
      } else {
        setError(`Sign-in incomplete: ${result.status}`)
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'errors' in e
          ? (e as { errors?: { message?: string }[] }).errors?.[0]?.message ??
            'Sign-in failed'
          : e instanceof Error
            ? e.message
            : 'Sign-in failed'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="absolute inset-0 z-50 bg-black">
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1"
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              paddingHorizontal: 24,
              paddingVertical: 32,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="mx-auto w-full max-w-sm">
              <Text className="mb-2 text-center text-3xl font-bold text-white">
                Do This Now
              </Text>
              <Text className="mb-10 text-center text-sm text-gray-500">
                Sign in to continue
              </Text>

              <Text className="mb-1.5 text-xs font-medium tracking-wider text-gray-400 uppercase">
                Email
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor="#4b5563"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                className="mb-5 w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3.5 text-base text-white"
              />

              <Text className="mb-1.5 text-xs font-medium tracking-wider text-gray-400 uppercase">
                Password
              </Text>
              <TextInput
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor="#4b5563"
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={onSignIn}
                className="mb-5 w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3.5 text-base text-white"
              />

              {error && (
                <View className="mb-5 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
                  <Text className="text-sm text-red-400">{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onSignIn}
                disabled={!canSubmit}
                activeOpacity={0.8}
                className={
                  'w-full items-center justify-center rounded-lg px-4 py-4 ' +
                  (canSubmit ? 'bg-white' : 'bg-gray-800')
                }
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text
                    className={
                      'text-base font-semibold ' +
                      (canSubmit ? 'text-black' : 'text-gray-500')
                    }
                  >
                    Sign in
                  </Text>
                )}
              </TouchableOpacity>

              <Text className="mt-8 text-center text-xs text-gray-600">
                Same email + password you set up on the web app.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}
