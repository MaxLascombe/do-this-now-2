import { useCreateTask } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'

import { TaskForm } from '../components/TaskForm'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()
  const { due, tag } = useLocalSearchParams<{ due?: string; tag?: string }>()

  // Calendar's "add for this day" passes a YYYY-M-D due to pre-fill the date;
  // the Tags screen passes a tag to pre-fill it on the new task.
  const initial = (() => {
    const init: { dueYear?: number; dueMonth?: number; dueDay?: number; tags?: string[] } = {}
    if (due) {
      const [y, m, d] = due.split('-').map((s) => parseInt(s, 10))
      if (y && m && d) Object.assign(init, { dueYear: y, dueMonth: m, dueDay: d })
    }
    if (tag) init.tags = [tag]
    return Object.keys(init).length > 0 ? init : undefined
  })()

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ title: 'New task' }} />
      <TaskForm
        initial={initial}
        isSaving={mutation.isPending}
        errorMessage={mutation.error?.message ?? null}
        onSubmit={(input) =>
          mutation.mutate(input, { onSuccess: () => router.back() })
        }
      />
    </View>
  )
}
