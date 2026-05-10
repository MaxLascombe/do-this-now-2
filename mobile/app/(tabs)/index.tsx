import { Stack, useRouter } from 'expo-router'
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../components/Loading'
import { Progress } from '../../components/Progress'
import { SwipeableTaskRow } from '../../components/SwipeableTaskRow'
import { useDing } from '../../hooks/useDing'
import { isSnoozed } from '@dtn/shared/task-sorting'
import {
  useCompleteTask,
  useDeleteTask,
  useSnoozeTask,
  useTopTasks,
} from '@dtn/shared/queries'

export default function Home() {
  const router = useRouter()
  const ding = useDing()

  const topTasks = useTopTasks()
  const tasks = (topTasks.data ?? []).filter((t) => !isSnoozed(t)).slice(0, 3)

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()

  const onComplete = (id: string) => {
    void ding()
    doneMutation.mutate(id)
  }
  const onSnooze = (id: string) => snoozeMutation.mutate({ id })
  const onDelete = (id: string, title: string) => {
    Alert.alert('Delete task', `Delete '${title}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={topTasks.isFetching && !topTasks.isPending}
            onRefresh={() => topTasks.refetch()}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
      >
        {topTasks.isPending || deleteMutation.isPending ? (
          <View className="flex-1 items-center justify-center">
            <Loading />
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <View className="items-center pb-2">
              <Progress />
            </View>
            <View className="border-t border-gray-800">
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <SwipeableTaskRow
                    key={task.id}
                    task={task}
                    onComplete={() => onComplete(task.id)}
                    onSnooze={() => onSnooze(task.id)}
                    onEdit={() => router.push(`/tasks/${task.id}/edit`)}
                    onDelete={() => onDelete(task.id, task.title)}
                  />
                ))
              ) : (
                <Text className="mt-10 text-center text-gray-400">
                  No tasks for now — tap + to add one.
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
