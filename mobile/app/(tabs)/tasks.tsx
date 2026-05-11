import { Stack, useRouter } from 'expo-router'
import { format } from 'date-fns'
import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  View,
} from 'react-native'
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
import type { Task } from '@dtn/shared/types'

type Sort = 'CHRON' | 'TOP'

type Section = {
  title: string
  pastDue?: boolean
  data: Task[]
}

const formatGroupDate = (date: Date) => {
  try {
    return format(date, 'EEE, LLL d, u')
  } catch {
    return date.toDateString()
  }
}

export default function TasksList() {
  const router = useRouter()
  const ding = useDing()
  const [sort, setSort] = useState<Sort>('CHRON')

  // Only fetch the active list. Pull-to-refresh below also only refetches
  // the active query.
  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()

  const onComplete = useCallback(
    (id: string) => {
      void ding()
      doneMutation.mutate(id)
    },
    [ding, doneMutation],
  )
  const onSnooze = useCallback(
    (id: string) => snoozeMutation.mutate({ id }),
    [snoozeMutation],
  )
  const onDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert('Delete task', `Delete '${title}'?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(id),
        },
      ])
    },
    [deleteMutation],
  )

  const sections: Section[] = useMemo(() => {
    const today0 = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    const tasks =
      sort === 'CHRON' ? [...(allTasks.data ?? [])] : [...(topTasks.data ?? [])]
    if (tasks.length === 0) return []

    if (sort === 'CHRON') {
      tasks.sort(
        (a, b) =>
          newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
      )
      const groups: Record<string, Task[]> = {}
      const order: string[] = []
      for (const task of tasks) {
        const key = formatGroupDate(newSafeDate(task.due))
        if (!groups[key]) {
          groups[key] = []
          order.push(key)
        }
        groups[key].push(task)
      }
      return order.map((key) => ({
        title: key,
        pastDue: newSafeDate(groups[key][0].due) < today0,
        data: groups[key],
      }))
    }

    // TOP: three sections — "Top", "Due after today", "Snoozed".
    sortTasks(tasks, today0)
    const top: Task[] = []
    const afterToday: Task[] = []
    const snoozed: Task[] = []
    const now = new Date()
    for (const task of tasks) {
      if (task.snooze && new Date(task.snooze) > now) snoozed.push(task)
      else if (newSafeDate(task.due) > now) afterToday.push(task)
      else top.push(task)
    }
    const result: Section[] = []
    if (top.length) result.push({ title: 'Today', data: top })
    if (afterToday.length)
      result.push({ title: 'Due after today', data: afterToday })
    if (snoozed.length) result.push({ title: 'Snoozed', data: snoozed })
    return result
  }, [sort, allTasks.data, topTasks.data])

  const renderItem = useCallback(
    ({ item }: { item: Task }) => (
      <SwipeableTaskRow
        task={item}
        onComplete={() => onComplete(item.id)}
        onSnooze={() => onSnooze(item.id)}
        onEdit={() => router.push(`/tasks/${item.id}/edit`)}
        onDelete={() => onDelete(item.id, item.title)}
      />
    ),
    [onComplete, onSnooze, onDelete, router],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: Section }) => (
      <SectionHeader label={section.title} pastDue={section.pastDue} />
    ),
    [],
  )

  const activeQuery = sort === 'CHRON' ? allTasks : topTasks
  const isFetching = activeQuery.isFetching && !activeQuery.isPending

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen options={{ title: 'Tasks' }} />
      <View className="items-center pb-3 pt-2">
        <Progress />
        <View className="mt-2">
          <SortToggle value={sort} onChange={setSort} />
        </View>
      </View>
      <SectionList
        className="flex-1 border-t border-gray-800"
        sections={sections}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => activeQuery.refetch()}
            tintColor="#fff"
            colors={['#fff']}
          />
        }
        ListEmptyComponent={
          activeQuery.isPending ? (
            <Loading />
          ) : (
            <Text className="mt-10 text-center text-gray-400">No tasks</Text>
          )
        }
      />
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
