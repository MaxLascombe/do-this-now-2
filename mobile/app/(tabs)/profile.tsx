import { useClerk, useUser } from '@clerk/clerk-expo'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import * as Haptics from 'expo-haptics'
import { Alert, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function Profile() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const initial =
    user?.firstName?.[0]?.toUpperCase() ??
    email?.[0]?.toUpperCase() ??
    '?'

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
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <View className="flex-1 px-4 pt-6">
        <View className="items-center pb-8">
          <View className="mb-3 h-20 w-20 items-center justify-center rounded-full border border-gray-800 bg-gray-950">
            <Text className="text-3xl font-bold text-white">{initial}</Text>
          </View>
          {user?.fullName && (
            <Text className="mb-1 text-lg font-semibold text-white">
              {user.fullName}
            </Text>
          )}
          {email && (
            <Text className="text-sm text-gray-500">{email}</Text>
          )}
        </View>

        <Pressable
          onPress={onSignOut}
          className="flex-row items-center justify-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-4 active:bg-red-950/60"
        >
          <FontAwesomeIcon
            icon={faRightFromBracket}
            size={16}
            color="#f87171"
          />
          <Text className="text-base font-semibold text-red-400">
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
