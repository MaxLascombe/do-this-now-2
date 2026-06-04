import { startOfToday } from '@dtn/shared/day-index'
import { dueGroupLabel, tasksListEyebrow } from '@dtn/shared/format'
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
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorState } from '../../components/ErrorState'
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

export default function TasksList() {
  const router = useRouter()
  const [sort, setSort] = useState<Sort>('CHRON')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const allTags = useMemo(() => {
    const source = sort === 'CHRON' ? allTasks.data : topTasks.data
    return [...new Set((source ?? []).flatMap((t) => t.tags))].sort()
  }, [sort, allTasks.data, topTasks.data])

  useEffect(() => {
    if (tagFilter && !allTags.includes(tagFilter)) setTagFilter(null)
  }, [tagFilter, allTags])

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
    let tasks =
      sort === 'CHRON' ? [...(allTasks.data ?? [])] : [...(topTasks.data ?? [])]
    if (tagFilter) tasks = tasks.filter((t) => t.tags.includes(tagFilter))
    const q = query.trim().toLowerCase()
    if (q)
      tasks = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
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
        ...dueGroupLabel(key),
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
  }, [sort, allTasks.data, topTasks.data, tagFilter, query])

  const eyebrow = useMemo(
    () =>
      tasksListEyebrow(
        sort === 'CHRON' ? (allTasks.data ?? []) : (topTasks.data ?? []),
      ),
    [sort, allTasks.data, topTasks.data],
  )

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
      <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search tasks…"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={{
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: 'rgba(24,24,27,0.6)',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            color: '#fafafa',
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 14,
          }}
        />
      </View>
      {allTags.length > 0 && (
        <TagFilterBar tags={allTags} active={tagFilter} onSelect={setTagFilter} />
      )}
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
          ) : activeQuery.isError ? (
            <View style={{ marginTop: 40 }}>
              <ErrorState
                message="Couldn't load your tasks."
                onRetry={() => activeQuery.refetch()}
              />
            </View>
          ) : (
            <Text
              style={{
                textAlign: 'center',
                marginTop: 40,
                color: '#71717a',
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {query.trim() || tagFilter ? 'No matching tasks' : 'No tasks'}
            </Text>
          )
        }
      />
    </SafeAreaView>
  )
}

function TagFilterBar({
  tags,
  active,
  onSelect,
}: {
  tags: string[]
  active: string | null
  onSelect: (tag: string | null) => void
}) {
  const chips: { key: string; label: string; value: string | null }[] = [
    { key: '__all', label: 'All', value: null },
    ...tags.map((t) => ({ key: t, label: `#${t}`, value: t })),
  ]
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 20,
        paddingBottom: 12,
        gap: 6,
      }}
    >
      {chips.map((c) => {
        const isActive = active === c.value
        return (
          <Pressable
            key={c.key}
            onPress={() => onSelect(isActive && c.value ? null : c.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={{
              borderWidth: 1,
              borderColor: isActive ? '#f4f4f5' : '#27272a',
              backgroundColor: isActive ? '#fafafa' : 'rgba(24,24,27,0.6)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 12,
                color: isActive ? '#0a0a0a' : '#a1a1aa',
              }}
            >
              {c.label}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
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
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
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
