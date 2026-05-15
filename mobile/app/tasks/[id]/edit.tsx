import { newSafeDate } from '@dtn/shared/helpers'
import { useDeleteTask, useTask, useUpdateTask } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, View } from 'react-native'

import { Loading } from '../../../components/Loading'
import { TaskForm } from '../../../components/TaskForm'

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const taskQuery = useTask(id ?? '')
  const mutation = useUpdateTask()
  const deleteMutation = useDeleteTask()

  if (taskQuery.isPending || !taskQuery.data) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
        }}
      >
        <Stack.Screen options={{ title: 'Edit' }} />
        <Loading />
      </View>
    )
  }

  const task = taskQuery.data
  const dueDate = newSafeDate(task.due)

  const onDelete = () => {
    Alert.alert('Delete task', `Delete '${task.title}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          deleteMutation.mutate(task.id, {
            onSuccess: () => router.back(),
          }),
      },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ title: `Edit: ${task.title}` }} />
      <TaskForm
        initial={{
          title: task.title,
          emoji: task.emoji,
          dueMonth: dueDate.getMonth() + 1,
          dueDay: dueDate.getDate(),
          dueYear: dueDate.getFullYear(),
          dueTime: task.dueTime,
          strictDeadline: task.strictDeadline,
          repeat: task.repeat,
          repeatInterval: task.repeatInterval,
          repeatUnit: task.repeatUnit,
          repeatWeekdays: task.repeatWeekdays,
          timeFrame: task.timeFrame,
          timekeeperId: task.timekeeperId,
          timeframeType: task.timeframeType,
          subtasks: task.subtasks,
        }}
        taskId={id}
        isSaving={mutation.isPending}
        errorMessage={mutation.error?.message ?? null}
        onDelete={onDelete}
        onSubmit={(input) =>
          mutation.mutate(
            { id: id ?? '', input },
            { onSuccess: () => router.back() },
          )
        }
      />
    </View>
  )
}
