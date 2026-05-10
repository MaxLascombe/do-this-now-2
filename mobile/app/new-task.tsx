import { Stack, useRouter } from 'expo-router'
import { View } from 'react-native'

import { TaskForm } from '../components/TaskForm'
import { useCreateTask } from '@dtn/shared/queries'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'New Task' }} />
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
