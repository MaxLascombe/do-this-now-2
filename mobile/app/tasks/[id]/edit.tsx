import { newSafeDate } from '@dtn/shared/helpers'
import { useDeleteTask, useTask, useUpdateTask } from '@dtn/shared/queries'
import { useUndo } from '@dtn/shared/undo'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Alert, View } from 'react-native'

import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import { TaskForm } from '../../../components/TaskForm'
import { useToast } from '../../../components/ToastProvider'

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const taskQuery = useTask(id ?? '')
  const mutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const undoStack = useUndo()
  const toast = useToast()

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
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading task"
            style={{ width: '100%', paddingHorizontal: 20, gap: 24 }}
          >
            <Skeleton style={{ height: 16, width: '33%' }} />
            <Skeleton style={{ height: 80, width: '100%', borderRadius: 16 }} />
            <Skeleton
              style={{ height: 288, width: '100%', borderRadius: 16 }}
            />
          </View>
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
        onPress: () => {
          deleteMutation.mutate(task.id, {
            onSuccess: () => {
              router.back()
              toast({
                message: `Deleted '${task.title}'`,
                actionLabel: 'Undo',
                onAction: () => void undoStack.undoLast(),
              })
            },
          })
        },
      },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen
        options={{
          title: `Edit: ${task.title}`,
        }}
      />
      <TaskForm
        initial={{
          title: task.title,
          emoji: task.emoji,
          dueMonth: dueDate.getMonth() + 1,
          dueDay: dueDate.getDate(),
          dueYear: dueDate.getFullYear(),
          dueTime: task.dueTime,
          strictDeadline: task.strictDeadline,
          canDoEarly: task.canDoEarly,
          surface: task.surface,
          repeat: task.repeat,
          repeatInterval: task.repeatInterval,
          repeatUnit: task.repeatUnit,
          repeatWeekdays: task.repeatWeekdays,
          timeFrame: task.timeFrame,
          timekeeperId: task.timekeeperId,
          timeframeType: task.timeframeType,
          subtasks: task.subtasks,
          tags: task.tags,
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
