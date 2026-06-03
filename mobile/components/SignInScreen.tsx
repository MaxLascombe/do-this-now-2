import type { SignInResource } from '@clerk/types'
import { useSignIn, useSSO } from '@clerk/clerk-expo'
import { faApple, faGoogle } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import * as AuthSession from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { useEffect, useState } from 'react'
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

// Required by expo-web-browser to dismiss the auth session sheet on
// iOS / Android when the user finishes signing in via OAuth.
WebBrowser.maybeCompleteAuthSession()

function clerkErrorMessage(e: unknown): string {
  if (typeof e === 'object' && e !== null && 'errors' in e) {
    return (
      (e as { errors?: { message?: string }[] }).errors?.[0]?.message ??
      'Something went wrong'
    )
  }
  if (e instanceof Error) return e.message
  return 'Something went wrong'
}

export function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn()
  const { startSSOFlow } = useSSO()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [emailLoading, setEmailLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<
    null | 'google' | 'apple'
  >(null)
  const [pendingMfa, setPendingMfa] = useState<{
    signIn: SignInResource
    setActive: NonNullable<ReturnType<typeof useSignIn>['setActive']>
  } | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [mfaLoading, setMfaLoading] = useState(false)

  useEffect(() => {
    void WebBrowser.warmUpAsync()
    return () => {
      void WebBrowser.coolDownAsync()
    }
  }, [])

  const onEmailSignIn = async () => {
    if (!isLoaded || emailLoading || oauthLoading) return
    if (!email || !password) return
    setError(null)
    setEmailLoading(true)
    try {
      const result = await signIn.create({ identifier: email, password })
      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId })
      } else if (result.status === 'needs_second_factor') {
        await prepareSecondFactorAndPrompt(result, setActive)
      } else {
        setError(`Sign-in incomplete: ${result.status}`)
      }
    } catch (e) {
      setError(clerkErrorMessage(e))
    } finally {
      setEmailLoading(false)
    }
  }

  const prepareSecondFactorAndPrompt = async (
    si: SignInResource,
    sa: NonNullable<ReturnType<typeof useSignIn>['setActive']>,
  ) => {
    const factors = si.supportedSecondFactors ?? []

    const totpFactor = factors.find((f) => f.strategy === 'totp')
    const backupFactor = factors.find((f) => f.strategy === 'backup_code')
    const emailFactor = factors.find((f) => f.strategy === 'email_code') as
      | { strategy: 'email_code'; emailAddressId?: string }
      | undefined
    const phoneFactor = factors.find((f) => f.strategy === 'phone_code') as
      | { strategy: 'phone_code'; phoneNumberId?: string }
      | undefined

    // TOTP & backup code don't need a prepare step.
    if (totpFactor || backupFactor) {
      setPendingMfa({ signIn: si, setActive: sa })
      return
    }

    if (emailFactor?.emailAddressId) {
      try {
        await si.prepareSecondFactor({
          strategy: 'email_code',
          emailAddressId: emailFactor.emailAddressId,
        })
        setPendingMfa({ signIn: si, setActive: sa })
        return
      } catch (e) {
        setError(clerkErrorMessage(e))
        return
      }
    }

    if (phoneFactor?.phoneNumberId) {
      try {
        await si.prepareSecondFactor({
          strategy: 'phone_code',
          phoneNumberId: phoneFactor.phoneNumberId,
        })
        setPendingMfa({ signIn: si, setActive: sa })
        return
      } catch (e) {
        setError(clerkErrorMessage(e))
        return
      }
    }

    const list = factors.map((f) => f.strategy).join(', ') || '(none)'
    setError(`MFA required but no UI for these factors: ${list}`)
  }

  const onSubmitMfa = async () => {
    if (!pendingMfa || !totpCode || mfaLoading) return
    setMfaLoading(true)
    setError(null)
    try {
      const factors = pendingMfa.signIn.supportedSecondFactors ?? []
      const strategy:
        | 'totp'
        | 'backup_code'
        | 'phone_code'
        | 'email_code' = factors.some((f) => f.strategy === 'totp')
        ? 'totp'
        : factors.some((f) => f.strategy === 'email_code')
          ? 'email_code'
          : factors.some((f) => f.strategy === 'phone_code')
            ? 'phone_code'
            : 'backup_code'
      const result = await pendingMfa.signIn.attemptSecondFactor({
        strategy,
        code: totpCode,
      })
      if (result.status === 'complete') {
        await pendingMfa.setActive({ session: result.createdSessionId })
        setPendingMfa(null)
        setTotpCode('')
      } else {
        setError(`MFA incomplete: ${result.status}`)
      }
    } catch (e) {
      setError(clerkErrorMessage(e))
    } finally {
      setMfaLoading(false)
    }
  }

  const onSSOSignIn = async (provider: 'google' | 'apple') => {
    if (oauthLoading || emailLoading) return
    setError(null)
    setOauthLoading(provider)
    try {
      const {
        createdSessionId,
        setActive: ssoSetActive,
        signIn: ssoSignIn,
      } = await startSSOFlow({
        strategy: provider === 'google' ? 'oauth_google' : 'oauth_apple',
        redirectUrl: AuthSession.makeRedirectUri({
          scheme: 'dothisnow',
          path: 'oauth-native-callback',
        }),
      })
      if (createdSessionId && ssoSetActive) {
        await ssoSetActive({ session: createdSessionId })
      } else if (
        ssoSignIn &&
        ssoSetActive &&
        ssoSignIn.status === 'needs_second_factor'
      ) {
        await prepareSecondFactorAndPrompt(ssoSignIn, ssoSetActive)
      }
      // else: user cancelled — no error
    } catch (e) {
      setError(clerkErrorMessage(e))
    } finally {
      setOauthLoading(null)
    }
  }

  const anyLoading = emailLoading || !!oauthLoading
  const canSubmitEmail = !anyLoading && email.length > 0 && password.length > 0

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

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => onSSOSignIn('apple')}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                  className="mb-3 w-full flex-row items-center justify-center gap-2 rounded-lg bg-white px-4 py-3.5"
                >
                  {oauthLoading === 'apple' ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faApple} size={18} color="#000" />
                      <Text className="text-base font-semibold text-black">
                        Continue with Apple
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => onSSOSignIn('google')}
                disabled={anyLoading}
                activeOpacity={0.8}
                className="mb-6 w-full flex-row items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-4 py-3.5"
              >
                {oauthLoading === 'google' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesomeIcon icon={faGoogle} size={16} color="#fff" />
                    <Text className="text-base font-semibold text-white">
                      Continue with Google
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View className="mb-6 flex-row items-center gap-3">
                <View className="h-px flex-1 bg-gray-800" />
                <Text className="text-xs text-gray-600">or with email</Text>
                <View className="h-px flex-1 bg-gray-800" />
              </View>

              <Text className="mb-1.5 text-xs font-medium tracking-wider text-gray-400 uppercase">
                Email
              </Text>
              <TextInput
                accessibilityLabel="Email"
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
                accessibilityLabel="Password"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                placeholder="••••••••"
                placeholderTextColor="#4b5563"
                value={password}
                onChangeText={setPassword}
                returnKeyType="go"
                onSubmitEditing={onEmailSignIn}
                className="mb-5 w-full rounded-lg border border-gray-800 bg-gray-950 px-4 py-3.5 text-base text-white"
              />

              {error && (
                <View className="mb-5 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
                  <Text className="text-sm text-red-400">{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onEmailSignIn}
                disabled={!canSubmitEmail}
                activeOpacity={0.8}
                className={
                  'w-full items-center justify-center rounded-lg px-4 py-4 ' +
                  (canSubmitEmail
                    ? 'border border-gray-700 bg-gray-900'
                    : 'border border-gray-800 bg-black')
                }
              >
                {emailLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className={
                      'text-base font-semibold ' +
                      (canSubmitEmail ? 'text-white' : 'text-gray-600')
                    }
                  >
                    Sign in with email
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {pendingMfa && (
        <View className="absolute inset-0 z-[60] items-center justify-center bg-black/90 px-6">
          <View className="w-full max-w-sm rounded-2xl border border-gray-800 bg-gray-950 p-6">
            <Text className="mb-2 text-center text-lg font-semibold text-white">
              Two-factor authentication
            </Text>
            <Text className="mb-5 text-center text-sm text-gray-500">
              {(() => {
                const factors = pendingMfa.signIn.supportedSecondFactors ?? []
                if (factors.some((f) => f.strategy === 'totp'))
                  return 'Enter the 6-digit code from your authenticator app.'
                if (factors.some((f) => f.strategy === 'email_code'))
                  return 'We sent a 6-digit code to your email. Enter it below.'
                if (factors.some((f) => f.strategy === 'phone_code'))
                  return 'We sent a 6-digit code to your phone. Enter it below.'
                return 'Enter your backup code.'
              })()}
            </Text>
            <TextInput
              accessibilityLabel="Verification code"
              autoFocus
              autoCapitalize="none"
              autoComplete="one-time-code"
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor="#4b5563"
              maxLength={6}
              value={totpCode}
              onChangeText={setTotpCode}
              onSubmitEditing={onSubmitMfa}
              returnKeyType="go"
              className="mb-4 w-full rounded-lg border border-gray-800 bg-black px-4 py-3.5 text-center text-xl tracking-widest text-white"
            />
            {error && (
              <View className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
                <Text className="text-sm text-red-400">{error}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={onSubmitMfa}
              disabled={mfaLoading || totpCode.length < 6}
              activeOpacity={0.8}
              className={
                'mb-2 w-full items-center rounded-lg px-4 py-3.5 ' +
                (totpCode.length >= 6 && !mfaLoading
                  ? 'bg-white'
                  : 'bg-gray-800')
              }
            >
              {mfaLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  className={
                    'text-base font-semibold ' +
                    (totpCode.length >= 6 ? 'text-black' : 'text-gray-500')
                  }
                >
                  Verify
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setPendingMfa(null)
                setTotpCode('')
                setError(null)
              }}
              activeOpacity={0.8}
              className="w-full items-center px-4 py-2"
            >
              <Text className="text-sm text-gray-500">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
