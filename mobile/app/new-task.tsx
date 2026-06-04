import { useCreateTask } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'

import { TaskForm } from '../components/TaskForm'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()
  const { due } = useLocalSearchParams<{ due?: string }>()

  // Calendar's "add for this day" passes a YYYY-M-D due to pre-fill the date.
  const initial = (() => {
    if (!due) return undefined
    const [y, m, d] = due.split('-').map((s) => parseInt(s, 10))
    if (!y || !m || !d) return undefined
    return { dueYear: y, dueMonth: m, dueDay: d }
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
