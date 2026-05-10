import { useSignIn } from '@clerk/clerk-expo'
import { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

export function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSignIn = async () => {
    if (!isLoaded) return
    setError(null)
    setLoading(true)
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
      } else {
        // Multi-factor or email verification step would land here.
        setError(`Sign-in incomplete: ${result.status}`)
      }
    } catch (e: unknown) {
      const msg =
        typeof e === 'object' && e !== null && 'errors' in e
          ? // Clerk error envelope
            (e as { errors?: { message?: string }[] }).errors?.[0]?.message ??
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
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="absolute inset-0 z-50 bg-black"
    >
      <View className="flex-1 items-center justify-center px-8">
        <Text className="mb-6 text-2xl font-bold text-white">Do This Now</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          className="mb-3 w-full max-w-sm rounded border border-gray-800 bg-black p-3 text-white"
        />
        <TextInput
          secureTextEntry
          autoCapitalize="none"
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          className="mb-3 w-full max-w-sm rounded border border-gray-800 bg-black p-3 text-white"
        />
        {error && (
          <Text className="mb-3 max-w-sm text-center text-sm text-red-500">
            {error}
          </Text>
        )}
        <TouchableOpacity
          onPress={onSignIn}
          disabled={loading || !email || !password}
          className="mt-2 w-full max-w-sm items-center rounded-full border border-gray-700 bg-gray-900 px-4 py-3 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="font-semibold text-white">Sign in</Text>
          )}
        </TouchableOpacity>
        <Text className="mt-6 max-w-sm text-center text-xs text-gray-500">
          Use the same email + password you set up on the web app.
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
