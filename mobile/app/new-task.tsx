import { useCreateTask } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { View } from 'react-native'

import { Loading } from '../components/Loading'
import { TaskForm } from '../components/TaskForm'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()
  const { due, tag } = useLocalSearchParams<{ due?: string; tag?: string }>()

  // Optional pre-fill via route params (?due=YYYY-M-D&tag=…), mirroring the
  // web new-task route. Nothing links here with params today.
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
      {mutation.isPending && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(10,10,10,0.7)',
          }}
        >
          <Loading />
        </View>
      )}
    </View>
  )
}
