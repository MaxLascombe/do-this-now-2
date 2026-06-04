import { newSafeDate } from '@dtn/shared/helpers'
import { useDeleteTask, useTask, useUpdateTask } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, ScrollView, View } from 'react-native'

import { ErrorState } from '../../../components/ErrorState'
import { Loading } from '../../../components/Loading'
import { TaskForm } from '../../../components/TaskForm'
import { TimerWidget } from '../../../components/TimerWidget'

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const taskQuery = useTask(id ?? '')
  const mutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  // 0-time-frame children show their keeper's timer.
  const keeperQuery = useTask(taskQuery.data?.timekeeperId ?? '')
  const timerTask = taskQuery.data?.timekeeperId
    ? keeperQuery.data
    : taskQuery.data

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
        {taskQuery.isPending ? (
          <Loading />
        ) : taskQuery.isError ? (
          <ErrorState
            message="Couldn't load this task."
            onRetry={() => taskQuery.refetch()}
          />
        ) : (
          <ErrorState message="Task not found." />
        )}
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
      {timerTask && (
        <ScrollView
          horizontal={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16 }}
          style={{ maxHeight: 280 }}
        >
          <TimerWidget
            task={timerTask}
            actionId={id ?? ''}
            plannedMinutes={timerTask.timeFrame}
          />
        </ScrollView>
      )}
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
          notes: task.notes,
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
