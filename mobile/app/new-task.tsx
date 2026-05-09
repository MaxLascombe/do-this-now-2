import { Stack, useRouter } from 'expo-router'
import { ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../components/Loading'
import { TaskForm } from '../components/TaskForm'
import { useCreateTask } from '../lib/queries'

export default function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'New Task' }} />
      <ScrollView>
        <TaskForm
          isSaving={mutation.isPending}
          errorMessage={mutation.error?.message ?? null}
          onSubmit={(input) =>
            mutation.mutate(input, { onSuccess: () => router.back() })
          }
        />
        {mutation.isPending && <Loading />}
      </ScrollView>
    </SafeAreaView>
  )
}
