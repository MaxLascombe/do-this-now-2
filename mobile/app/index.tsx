import {
  faBackward,
  faBars,
  faBell,
  faCheckCircle,
  faPen,
  faPlusCircle,
  faRightFromBracket,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useClerk } from '@clerk/clerk-expo'
import { Stack, useRouter } from 'expo-router'
import { Fragment, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Button } from '../components/Button'
import { Loading } from '../components/Loading'
import { Progress } from '../components/Progress'
import { TaskBox } from '../components/TaskBox'
import { useDing } from '../hooks/useDing'
import {
  useCompleteTask,
  useDeleteTask,
  useSnoozeTask,
  useTopTasks,
} from '../lib/queries'
import { isSnoozed } from '@dtn/shared/task-sorting'

export default function Home() {
  const router = useRouter()
  const ding = useDing()
  const { signOut } = useClerk()

  const topTasks = useTopTasks()
  const tasks = (topTasks.data ?? []).filter((t) => !isSnoozed(t))

  const [selectedTaskIndex, setSelectedTaskIndex] = useState<0 | 1 | 2>(0)
  const selectedTask =
    tasks.length > selectedTaskIndex ? tasks[selectedTaskIndex] : tasks[0]

  if (tasks.length > 0 && tasks.length <= selectedTaskIndex)
    setSelectedTaskIndex(tasks.length === 2 ? 1 : 0)

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()

  const completingId = doneMutation.isPending
    ? (doneMutation.variables as string)
    : null
  const deletingId = deleteMutation.isPending
    ? (deleteMutation.variables as string)
    : null

  const completeAction = () => {
    if (!selectedTask) return
    void ding()
    doneMutation.mutate(selectedTask.id)
  }
  const snoozeAction = () => {
    if (!selectedTask) return
    snoozeMutation.mutate({ id: selectedTask.id })
  }
  const snoozeAllSubtasksAction = () => {
    if (!selectedTask) return
    snoozeMutation.mutate({ id: selectedTask.id, allSubtasks: true })
  }
  const deleteAction = () => {
    if (!selectedTask) return
    Alert.alert(
      'Delete task',
      `Are you sure you want to delete '${selectedTask.title}'?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(selectedTask.id),
        },
      ],
    )
  }
  const goEdit = () => {
    if (!selectedTask) return
    router.push(`/tasks/${selectedTask.id}/edit`)
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {topTasks.isPending || deleteMutation.isPending ? (
          <View className="flex-1 items-center justify-center">
            <Loading />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-2 py-6">
            <Progress />
            <View className="mx-5 mt-1 flex-row flex-wrap justify-center">
              <Button
                onPress={() => router.push('/tasks')}
                text="All tasks"
                icon={faBars}
              />
              <Button
                onPress={() => router.push('/new-task')}
                text="New task"
                icon={faPlusCircle}
              />
              <Button
                onPress={() => router.push('/history')}
                text="History"
                icon={faBackward}
              />
            </View>
            {tasks.length > 0 ? (
              tasks.slice(0, 3).map((task, i) => (
                <Fragment key={task.id}>
                  <View className="w-full px-4">
                    <TaskBox
                      isSelected={selectedTaskIndex === i}
                      onPress={() =>
                        (i === 0 || i === 1 || i === 2) &&
                        setSelectedTaskIndex(i as 0 | 1 | 2)
                      }
                      task={task}
                    />
                  </View>
                  {selectedTaskIndex === i && (
                    <View className="mx-5 flex-row flex-wrap justify-center">
                      <Button
                        onPress={completeAction}
                        text="Complete"
                        icon={faCheckCircle}
                        loading={completingId === task.id}
                      />
                      <Button
                        onPress={snoozeAction}
                        text="Snooze"
                        icon={faBell}
                      />
                      {task.subtasks.length > 0 && (
                        <Button
                          onPress={snoozeAllSubtasksAction}
                          text="Snooze all subtasks"
                          icon={faBell}
                        />
                      )}
                      <Button onPress={goEdit} icon={faPen} />
                      <Button
                        onPress={deleteAction}
                        icon={faTrash}
                        loading={
                          deletingId === task.id
                        }
                      />
                    </View>
                  )}
                </Fragment>
              ))
            ) : (
              <Text className="text-gray-400">No tasks</Text>
            )}
          </View>
        )}
      </ScrollView>
      <View className="absolute right-5 bottom-8">
        <Button
          icon={faRightFromBracket}
          onPress={() => signOut()}
          text="Log out"
        />
      </View>
    </SafeAreaView>
  )
}
