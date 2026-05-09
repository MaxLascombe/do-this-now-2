import {
  faBackward,
  faForward,
  faHome,
} from '@fortawesome/free-solid-svg-icons'
import { Stack, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '../components/Button'
import { Loading } from '../components/Loading'
import { Progress } from '../components/Progress'
import { TaskBox } from '../components/TaskBox'
import { dateString } from '@dtn/shared/helpers'
import type { Task } from '@dtn/shared/schema'
import { useHistory } from '../lib/queries'

export default function History() {
  const router = useRouter()
  const [daysAgo, setDaysAgo] = useState(0)

  const date = dateString(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate() - daysAgo,
    ),
  )

  const { data, isLoading } = useHistory(date)

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'History' }} />
      <View className="py-4">
        <Progress />
        <View className="mt-2 flex-row flex-wrap justify-center pb-2">
          <Button
            onPress={() => router.push('/')}
            icon={faHome}
            text="Home"
          />
        </View>
        <View className="flex-row items-center justify-center gap-2">
          <Button
            icon={faBackward}
            onPress={() => setDaysAgo((d) => d + 1)}
          />
          <Text className="text-xs text-white">
            {new Date(
              new Date().setDate(new Date().getDate() - daysAgo),
            ).toLocaleDateString()}
          </Text>
          <Button
            icon={faForward}
            onPress={() => setDaysAgo((d) => Math.max(0, d - 1))}
          />
        </View>
      </View>
      <ScrollView className="flex-1 px-3">
        {isLoading ? (
          <Loading />
        ) : (
          <>
            {(data ?? []).map((row) => (
              <TaskBox
                key={row.id}
                isSelected={false}
                task={row.taskSnapshot as Task}
              />
            ))}
            {(data ?? []).length === 0 && (
              <Text className="mt-10 text-center text-gray-400">
                Nothing completed.
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
