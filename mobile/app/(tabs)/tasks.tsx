import { Stack, useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../components/Loading'
import { Progress } from '../../components/Progress'
import { SwipeableTaskRow } from '../../components/SwipeableTaskRow'
import { useDing } from '../../hooks/useDing'
import { newSafeDate } from '@dtn/shared/helpers'
import { sortTasks } from '@dtn/shared/task-sorting'
import {
  useAllTasks,
  useCompleteTask,
  useDeleteTask,
  useSnoozeTask,
  useTopTasks,
} from '@dtn/shared/queries'

type Sort = 'CHRON' | 'TOP'

export default function TasksList() {
  const router = useRouter()
  const ding = useDing()
  const [sort, setSort] = useState<Sort>('CHRON')

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
  const snoozeMutation = useSnoozeTask()

  const onComplete = (id: string) => {
    void ding()
    doneMutation.mutate(id)
  }
  const onSnooze = (id: string) => snoozeMutation.mutate({ id })
  const onDelete = (id: string, title: string) => {
    Alert.alert('Delete task', `Delete '${title}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(id),
      },
    ])
  }

  const formatGroupDate = (date: Date) => {
    try {
      return format(date, 'EEE, LLL d, u')
    } catch {
      return date.toDateString()
    }
  }

  const today0 = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate(),
  )

  const children: React.ReactNode[] = []
  const stickyIndices: number[] = []

  if (sort === 'CHRON') {
    const groups: Record<string, typeof tasks> = {}
    for (const task of tasks) {
      const dateKey =
        task.due === 'No Due Date'
          ? 'No Due Date'
          : formatGroupDate(newSafeDate(task.due))
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(task)
    }
    for (const [dateLabel, dateTasks] of Object.entries(groups)) {
      const isPastDue =
        dateTasks[0].due !== 'No Due Date' &&
        newSafeDate(dateTasks[0].due) < today0
      stickyIndices.push(children.length)
      children.push(<SectionHeader key={`h-${dateLabel}`} label={dateLabel} pastDue={isPastDue} />)
      for (const task of dateTasks) {
        children.push(
          <SwipeableTaskRow
            key={task.id}
            task={task}
            onComplete={() => onComplete(task.id)}
            onSnooze={() => onSnooze(task.id)}
            onEdit={() => router.push(`/tasks/${task.id}/edit`)}
            onDelete={() => onDelete(task.id, task.title)}
          />,
        )
      }
    }
  } else {
    const firstAfterToday = tasks.findIndex(
      (t) => t.due !== 'No Due Date' && newSafeDate(t.due) > new Date(),
    )
    const firstSnoozed = tasks.findIndex(
      (t) => t.snooze && new Date(t.snooze) > new Date(),
    )
    tasks.forEach((task, i) => {
      if (i === firstAfterToday) {
        stickyIndices.push(children.length)
        children.push(<SectionHeader key="h-after" label="Due after today" />)
      }
      if (i === firstSnoozed && i !== firstAfterToday) {
        stickyIndices.push(children.length)
        children.push(<SectionHeader key="h-snoozed" label="Snoozed" />)
      }
      children.push(
        <SwipeableTaskRow
          key={task.id}
          task={task}
          onComplete={() => onComplete(task.id)}
          onSnooze={() => onSnooze(task.id)}
          onEdit={() => router.push(`/tasks/${task.id}/edit`)}
          onDelete={() => onDelete(task.id, task.title)}
        />,
      )
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'Tasks' }} />
      <View className="items-center pb-3 pt-2">
        <Progress />
        <View className="mt-2">
          <SortToggle value={sort} onChange={setSort} />
        </View>
      </View>
      <ScrollView
        className="flex-1 border-t border-gray-800"
        stickyHeaderIndices={stickyIndices}
        refreshControl={
          <RefreshControl
            refreshing={
              (sort === 'CHRON' ? allTasks : topTasks).isFetching &&
              !(sort === 'CHRON' ? allTasks : topTasks).isPending
            }
            onRefresh={() => {
              allTasks.refetch()
              topTasks.refetch()
            }}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
      >
        {((sort === 'CHRON' && allTasks.isFetching) ||
          (sort === 'TOP' && topTasks.isFetching)) && <Loading />}

        {children}

        {tasks.length === 0 && !allTasks.isPending && (
          <Text className="mt-10 text-center text-gray-400">No tasks</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SortToggle({
  value,
  onChange,
}: {
  value: Sort
  onChange: (s: Sort) => void
}) {
  const options: { key: Sort; label: string }[] = [
    { key: 'CHRON', label: 'Date' },
    { key: 'TOP', label: 'Priority' },
  ]
  return (
    <View className="flex-row overflow-hidden rounded-full border border-gray-800 bg-gray-950">
      {options.map((o) => {
        const active = value === o.key
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={
              'px-4 py-1.5 ' + (active ? 'bg-white' : 'bg-transparent')
            }
          >
            <Text
              className={
                'text-xs font-medium ' +
                (active ? 'text-black' : 'text-gray-300')
              }
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function SectionHeader({
  label,
  pastDue = false,
}: {
  label: string
  pastDue?: boolean
}) {
  return (
    <View className="border-b border-t border-gray-800 bg-gray-950 px-4 py-2">
      <Text
        className={
          'text-xs font-medium uppercase tracking-wider ' +
          (pastDue ? 'text-orange-300' : 'text-gray-400')
        }
      >
        {label}
      </Text>
    </View>
  )
}
