import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../../components/Loading'
import { TaskForm } from '../../../components/TaskForm'
import { newSafeDate } from '@dtn/shared/helpers'
import { useTask, useUpdateTask } from '../../../lib/queries'

export default function EditTask() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const taskQuery = useTask(id ?? '')
  const mutation = useUpdateTask()

  if (taskQuery.isPending || !taskQuery.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-black">
        <Stack.Screen options={{ title: 'Edit' }} />
        <Loading />
      </SafeAreaView>
    )
  }

  const task = taskQuery.data
  const dueDate = newSafeDate(task.due)

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: `Edit: ${task.title}` }} />
      <ScrollView>
        <TaskForm
          initial={{
            title: task.title,
            dueMonth: dueDate.getMonth() + 1,
            dueDay: dueDate.getDate(),
            dueYear: dueDate.getFullYear(),
            strictDeadline: task.strictDeadline,
            repeat: task.repeat,
            repeatInterval: task.repeatInterval,
            repeatUnit: task.repeatUnit,
            repeatWeekdays: task.repeatWeekdays,
            timeFrame: task.timeFrame,
            subtasks: task.subtasks,
          }}
          isSaving={mutation.isPending}
          errorMessage={mutation.error?.message ?? null}
          onSubmit={(input) =>
            mutation.mutate(
              { id: id ?? '', input },
              { onSuccess: () => router.back() },
            )
          }
        />
      </ScrollView>
    </SafeAreaView>
  )
}
