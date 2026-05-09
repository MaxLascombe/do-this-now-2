import {
  faArrowDown,
  faCheckCircle,
  faHome,
  faPen,
  faPlusCircle,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { Stack, useRouter } from 'expo-router'
import { Fragment, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '../../components/Button'
import { Loading } from '../../components/Loading'
import { Progress } from '../../components/Progress'
import { TaskBox } from '../../components/TaskBox'
import { useDing } from '../../hooks/useDing'
import { newSafeDate } from '@dtn/shared/helpers'
import { sortTasks } from '@dtn/shared/task-sorting'
import {
  useAllTasks,
  useCompleteTask,
  useDeleteTask,
  useTopTasks,
} from '../../lib/queries'

export default function TasksList() {
  const router = useRouter()
  const ding = useDing()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sort, setSort] = useState<'CHRON' | 'TOP'>('CHRON')

  const allTasks = useAllTasks()
  const topTasks = useTopTasks()

  let tasks =
    sort === 'CHRON' ? [...(allTasks.data ?? [])] : [...(topTasks.data ?? [])]

  if (sort === 'CHRON') {
    tasks.sort((a, b) =>
      a.due === 'No Due Date'
        ? -1
        : b.due === 'No Due Date'
          ? 1
          : newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
    )
  } else {
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    sortTasks(tasks, today)
  }

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const completingId = doneMutation.isPending
    ? (doneMutation.variables as string)
    : null
  const deletingId = deleteMutation.isPending
    ? (deleteMutation.variables as string)
    : null

  const completeAction = () => {
    const t = tasks[selectedIndex]
    if (!t) return
    void ding()
    doneMutation.mutate(t.id)
  }

  const deleteAction = (id: string, title: string) => {
    Alert.alert('Delete task', `Delete '${title}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ])
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'Tasks' }} />
      <View className="py-4">
        <Progress />
        <View className="mt-3 flex-row flex-wrap justify-center">
          <Button
            onPress={() => router.push('/')}
            icon={faHome}
            text="Home"
          />
          <Button
            onPress={() => router.push('/new-task')}
            icon={faPlusCircle}
            text="New"
          />
          <Button
            onPress={() => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON'))}
            icon={faArrowDown}
            text={sort === 'CHRON' ? 'By date' : 'By priority'}
          />
        </View>
      </View>
      <ScrollView className="flex-1 px-3">
        {((sort === 'CHRON' && allTasks.isFetching) ||
          (sort === 'TOP' && topTasks.isFetching)) && <Loading />}
        {tasks.map((task, i) => (
          <Fragment key={task.id}>
            <TaskBox
              isSelected={i === selectedIndex}
              onPress={() => setSelectedIndex(i)}
              task={task}
            />
            {i === selectedIndex && (
              <View className="mb-3 flex-row flex-wrap justify-center">
                <Button
                  text="Complete"
                  icon={faCheckCircle}
                  onPress={completeAction}
                  loading={completingId === task.id}
                />
                <Button
                  text="Edit"
                  icon={faPen}
                  onPress={() => router.push(`/tasks/${task.id}/edit`)}
                />
                <Button
                  text="Delete"
                  icon={faTrash}
                  onPress={() => deleteAction(task.id, task.title)}
                  loading={deletingId === task.id}
                />
              </View>
            )}
          </Fragment>
        ))}
        {tasks.length === 0 && !allTasks.isPending && (
          <Text className="mt-10 text-center text-gray-400">No tasks</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
