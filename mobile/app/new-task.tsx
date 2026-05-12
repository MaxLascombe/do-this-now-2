import { useCreateTask } from '@dtn/shared/queries'
import { Stack, useRouter } from 'expo-router'
import { View } from 'react-native'

import { TaskForm } from '../components/TaskForm'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ title: 'New task' }} />
      <TaskForm
        isSaving={mutation.isPending}
        errorMessage={mutation.error?.message ?? null}
        onSubmit={(input) =>
          mutation.mutate(input, { onSuccess: () => router.back() })
        }
      />
    </View>
  )
}
