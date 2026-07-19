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
  StyleSheet,
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
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(
    null,
  )
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
      const strategy: 'totp' | 'backup_code' | 'phone_code' | 'email_code' =
        factors.some((f) => f.strategy === 'totp')
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
    <View style={s.root}>
      <SafeAreaView style={s.flex1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.flex1}
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
            <View style={s.card}>
              <Text style={s.title}>Do This Now</Text>
              <Text style={s.subtitle}>Sign in to continue</Text>

              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => onSSOSignIn('apple')}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                  style={[s.oauthButton, s.appleButton]}
                >
                  {oauthLoading === 'apple' ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faApple} size={18} color="#000" />
                      <Text style={s.appleButtonText}>Continue with Apple</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={() => onSSOSignIn('google')}
                disabled={anyLoading}
                activeOpacity={0.8}
                style={[s.oauthButton, s.googleButton]}
              >
                {oauthLoading === 'google' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <FontAwesomeIcon icon={faGoogle} size={16} color="#fff" />
                    <Text style={s.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or with email</Text>
                <View style={s.dividerLine} />
              </View>

              <Text style={s.fieldLabel}>Email</Text>
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
                style={s.input}
              />

              <Text style={s.fieldLabel}>Password</Text>
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
                style={s.input}
              />

              {error && (
                <View accessibilityLiveRegion="assertive" style={s.errorBox}>
                  <Text style={s.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onEmailSignIn}
                disabled={!canSubmitEmail}
                activeOpacity={0.8}
                style={[
                  s.emailButton,
                  canSubmitEmail ? s.emailButtonEnabled : s.emailButtonDisabled,
                ]}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[
                      s.emailButtonText,
                      { color: canSubmitEmail ? '#fff' : '#4b5563' },
                    ]}
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
        <View style={s.mfaBackdrop}>
          <View style={s.mfaCard}>
            <Text style={s.mfaTitle}>Two-factor authentication</Text>
            <Text style={s.mfaSubtitle}>
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
              style={s.mfaInput}
            />
            {error && (
              <View accessibilityLiveRegion="assertive" style={s.errorBox}>
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={onSubmitMfa}
              disabled={mfaLoading || totpCode.length < 6}
              activeOpacity={0.8}
              style={[
                s.mfaSubmit,
                totpCode.length >= 6 && !mfaLoading
                  ? s.mfaSubmitEnabled
                  : s.mfaSubmitDisabled,
              ]}
            >
              {mfaLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text
                  style={[
                    s.mfaSubmitText,
                    { color: totpCode.length >= 6 ? '#000' : '#6b7280' },
                  ]}
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
              style={s.mfaCancel}
            >
              <Text style={s.mfaCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 50,
    backgroundColor: '#000',
  },
  flex1: { flex: 1 },
  card: { width: '100%', maxWidth: 384, alignSelf: 'center' },
  title: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    marginBottom: 40,
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
  },
  oauthButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  appleButton: { marginBottom: 12, backgroundColor: '#fff' },
  appleButtonText: { fontSize: 16, fontWeight: '600', color: '#000' },
  googleButton: {
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#374151',
    backgroundColor: '#030712',
  },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  dividerRow: {
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: { height: 1, flex: 1, backgroundColor: '#1f2937' },
  dividerText: { fontSize: 12, color: '#4b5563' },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1,
    color: '#9ca3af',
    textTransform: 'uppercase',
  },
  input: {
    marginBottom: 20,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#030712',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  errorBox: {
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,29,29,0.5)',
    backgroundColor: 'rgba(69,10,10,0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  errorText: { fontSize: 14, color: '#f87171' },
  emailButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
  },
  emailButtonEnabled: { borderColor: '#374151', backgroundColor: '#111827' },
  emailButtonDisabled: { borderColor: '#1f2937', backgroundColor: '#000' },
  emailButtonText: { fontSize: 16, fontWeight: '600' },
  mfaBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingHorizontal: 24,
  },
  mfaCard: {
    width: '100%',
    maxWidth: 384,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#030712',
    padding: 24,
  },
  mfaTitle: {
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  mfaSubtitle: {
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 14,
    color: '#6b7280',
  },
  mfaInput: {
    marginBottom: 16,
    width: '100%',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#000',
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
    fontSize: 20,
    letterSpacing: 6,
    color: '#fff',
  },
  mfaSubmit: {
    marginBottom: 8,
    width: '100%',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mfaSubmitEnabled: { backgroundColor: '#fff' },
  mfaSubmitDisabled: { backgroundColor: '#1f2937' },
  mfaSubmitText: { fontSize: 16, fontWeight: '600' },
  mfaCancel: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mfaCancelText: { fontSize: 14, color: '#6b7280' },
})
