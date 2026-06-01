import { newSafeDate } from '@dtn/shared/helpers'
import {
  useAllTasks,
  useCompleteTask,
  useDeleteTask,
  useSnoozeTask,
  useTopTasks,
} from '@dtn/shared/queries'
import { sortTasks } from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  completionConfirmKind,
  confirmMessage,
  isCompletionGated,
} from '@dtn/shared/timer-utils'
import type { Task } from '@dtn/shared/types'
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
import { PageHeading } from '../../components/PageHeading'
import { SwipeableTaskRow } from '../../components/SwipeableTaskRow'
import { TopProgress } from '../../components/TopProgress'

type Sort = 'CHRON' | 'TOP'

type Group = {
  key: string
  label: string
  eyebrow: string
  overdueSuffix: string | null
  data: Task[]
}

const OVERDUE = '#fb7185'

const startOfToday = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

const dayIndex = (d: Date) => {
  const today = startOfToday()
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      today.getTime()) /
      (24 * 60 * 60 * 1000),
  )
}

const groupOf = (
  firstTaskDue: string,
): Omit<Group, 'key' | 'data'> => {
  const d = newSafeDate(firstTaskDue)
  const idx = dayIndex(d)
  if (idx < 0) {
    const days = Math.abs(idx)
    return {
      label: format(d, 'EEEE'),
      eyebrow: format(d, 'LLL d'),
      overdueSuffix: `${days} day${days === 1 ? '' : 's'} overdue`,
    }
  }
  if (idx === 0)
    return {
      label: 'Today',
      eyebrow: format(d, 'EEEE, LLL d'),
      overdueSuffix: null,
    }
  if (idx === 1)
    return {
      label: 'Tomorrow',
      eyebrow: format(d, 'EEEE, LLL d'),
      overdueSuffix: null,
    }
  return {
    label: format(d, 'EEEE'),
    eyebrow: format(d, 'LLL d'),
    overdueSuffix: null,
  }
}

export default function TasksList() {
  const router = useRouter()
  const [sort, setSort] = useState<Sort>('CHRON')

  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()

  const allData = sort === 'CHRON' ? allTasks.data : topTasks.data
  const onComplete = useCallback(
    (id: string) => {
      const t = (allData ?? []).find((x) => x.id === id)
      if (!t) {
        doneMutation.mutate({ id })
        return
      }
      const now = new Date()
      if (isCompletionGated(t, now)) return
      if (willAdvanceSubtask(t, now)) {
        doneMutation.mutate({ id })
        return
      }
      const kind = completionConfirmKind(t, now)
      if (!kind) {
        doneMutation.mutate({ id })
        return
      }
      Alert.alert('Count this time?', confirmMessage(t, now, kind), [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Don't count",
          onPress: () => {
            doneMutation.mutate({ id, countMeasurement: false })
          },
        },
        {
          text: 'Count it',
          onPress: () => {
            doneMutation.mutate({ id, countMeasurement: true })
          },
        },
      ])
    },
    [doneMutation, allData],
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

  const sections: Group[] = useMemo(() => {
    const today0 = startOfToday()
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
        const key = task.due
        if (!groups[key]) {
          groups[key] = []
          order.push(key)
        }
        groups[key].push(task)
      }
      return order.map((key) => ({
        key,
        ...groupOf(key),
        data: groups[key],
      }))
    }

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
    const result: Group[] = []
    const blank = { eyebrow: '', overdueSuffix: null as string | null }
    if (top.length)
      result.push({ key: 'top', label: 'Today', ...blank, data: top })
    if (afterToday.length)
      result.push({
        key: 'after',
        label: 'Due after today',
        ...blank,
        data: afterToday,
      })
    if (snoozed.length)
      result.push({
        key: 'snoozed',
        label: 'Snoozed',
        ...blank,
        data: snoozed,
      })
    return result
  }, [sort, allTasks.data, topTasks.data])

  const eyebrow = useMemo(() => {
    const tasks =
      sort === 'CHRON' ? (allTasks.data ?? []) : (topTasks.data ?? [])
    const total = tasks.length
    const weekStart = startOfToday()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const thisWeek = tasks.filter((t) => {
      const d = newSafeDate(t.due)
      return d >= weekStart && d < weekEnd
    }).length
    return `${total} active · ${thisWeek} this week`
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
    ({ section }: { section: Group }) => <GroupHeader group={section} />,
    [],
  )

  const activeQuery = sort === 'CHRON' ? allTasks : topTasks
  const isFetching = activeQuery.isFetching && !activeQuery.isPending

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopProgress />
      <PageHeading eyebrow={eyebrow}>All tasks</PageHeading>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <SortToggle value={sort} onChange={setSort} />
      </View>
      <SectionList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        sections={sections}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={() => activeQuery.refetch()}
            tintColor="#fafafa"
            colors={['#fafafa']}
          />
        }
        ListEmptyComponent={
          activeQuery.isPending ? (
            <Loading />
          ) : (
            <Text
              style={{
                textAlign: 'center',
                marginTop: 40,
                color: '#71717a',
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              No tasks
            </Text>
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
    { key: 'CHRON', label: 'By date' },
    { key: 'TOP', label: 'By priority' },
  ]
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
        padding: 4,
        borderRadius: 999,
      }}
    >
      {options.map((o) => {
        const active = value === o.key
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: active ? '#fafafa' : 'transparent',
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: active ? '#0a0a0a' : '#a1a1aa',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

function GroupHeader({ group }: { group: Group }) {
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        {group.eyebrow !== '' && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 10,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: '#a1a1aa',
            }}
          >
            {group.eyebrow}
            {group.overdueSuffix && (
              <>
                <Text style={{ color: '#a1a1aa' }}> · </Text>
                <Text style={{ color: OVERDUE }}>{group.overdueSuffix}</Text>
              </>
            )}
          </Text>
        )}
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            fontSize: 14,
            color: '#fafafa',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginTop: 2,
          }}
        >
          {group.label}
        </Text>
      </View>
      <View
        style={{ flex: 1, height: 1, backgroundColor: '#18181b', marginBottom: 6 }}
      />
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 11,
          color: '#52525b',
        }}
      >
        {group.data.length}
      </Text>
    </View>
  )
}
