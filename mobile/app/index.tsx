import { Stack } from 'expo-router'
import { Text, View } from 'react-native'

export default function Home() {
  return (
    <>
      <Stack.Screen options={{ title: 'Do This Now' }} />
      <View className="flex-1 items-center justify-center bg-black">
        <Text className="text-gray-400">Home — coming up</Text>
      </View>
    </>
  )
}
