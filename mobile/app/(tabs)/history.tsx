import { Stack } from 'expo-router'
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../components/Loading'
import { TaskBox } from '../../components/TaskBox'
import { dateString } from '@dtn/shared/helpers'
import { useHistory } from '@dtn/shared/queries'

const DAY_MS = 24 * 60 * 60 * 1000
const SWIPE_THRESHOLD = 50

export default function History() {
  const [daysAgo, setDaysAgo] = useState(0)

  const goOlder = useCallback(() => setDaysAgo((d) => d + 1), [])
  const goNewer = useCallback(
    () => setDaysAgo((d) => Math.max(0, d - 1)),
    [],
  )

  const dayDate = new Date(Date.now() - daysAgo * DAY_MS)
  const date = dateString(dayDate)

  const historyQuery = useHistory(date)
  const { data, isLoading } = historyQuery

  // runOnJS(true) keeps the entire gesture on the JS thread — avoids the
  // Reanimated worklet runtime entirely.
  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        goOlder()
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        goNewer()
      }
    })

  const dateLabel = dayDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
  const relative =
    daysAgo === 0
      ? 'Today'
      : daysAgo === 1
        ? 'Yesterday'
        : `${daysAgo} days ago`

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: 'History' }} />
      <GestureDetector gesture={swipe}>
        <View className="flex-1">
          <View className="items-center border-b border-gray-800 py-4">
            <Text className="text-xs uppercase tracking-wider text-gray-500">
              {relative}
            </Text>
            <Text className="mt-1 text-base font-semibold text-white">
              {dateLabel}
            </Text>
            <Text className="mt-1 text-xs text-gray-600">
              ← swipe to change day →
            </Text>
          </View>
          <ScrollView
            className="flex-1"
            refreshControl={
              <RefreshControl
                refreshing={
                  historyQuery.isFetching && !historyQuery.isPending
                }
                onRefresh={() => historyQuery.refetch()}
                tintColor="#fff"
                colors={['#fff']}
              />
            }
          >
            {isLoading ? (
              <View className="py-10">
                <Loading />
              </View>
            ) : (data ?? []).length === 0 ? (
              <Text className="mt-10 text-center text-gray-500">
                Nothing completed.
              </Text>
            ) : (
              (data ?? []).map((row) => (
                <TaskBox key={row.id} task={row.taskSnapshot} />
              ))
            )}
          </ScrollView>
        </View>
      </GestureDetector>
    </SafeAreaView>
  )
}
