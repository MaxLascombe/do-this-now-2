import { useClerk, useUser } from '@clerk/clerk-expo'
import * as Haptics from 'expo-haptics'
import { Stack } from 'expo-router'
import { Alert, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PageHeading } from '../components/PageHeading'

const OVERDUE = '#fb7185'

export default function Settings() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const initial =
    user?.firstName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?'

  const onSignOut = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ])
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <PageHeading eyebrow="account">Settings</PageHeading>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          gap: 24,
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: 'rgba(24,24,27,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 30,
                color: '#fafafa',
              }}
            >
              {initial}
            </Text>
          </View>
          {user?.fullName && (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 16,
                color: '#fafafa',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {user.fullName}
            </Text>
          )}
          {email && (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: '#71717a',
              }}
            >
              {email}
            </Text>
          )}
        </View>

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(251,113,133,0.3)',
            backgroundColor: pressed ? 'rgba(251,113,133,0.12)' : 'transparent',
          })}
        >
          <Text style={{ color: OVERDUE, fontSize: 16 }}>⏻</Text>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 15,
              color: OVERDUE,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
