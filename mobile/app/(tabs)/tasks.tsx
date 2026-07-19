import { startOfToday } from '@dtn/shared/day-index'
import { dueGroupLabel, tasksListEyebrow } from '@dtn/shared/format'
import { newSafeDate } from '@dtn/shared/helpers'
import {
  useAllTasks,
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useSnoozeTask,
  useTaskTimer,
  useTopTasks,
  useUnsnoozeTask,
} from '@dtn/shared/queries'
import { isSnoozed, sortTasks } from '@dtn/shared/task-sorting'
import { taskToInput } from '@dtn/shared/task-input'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  completionConfirmKind,
  confirmMessage,
  isCompletionGated,
} from '@dtn/shared/timer-utils'
import type { Task } from '@dtn/shared/types'
import { Stack, useRouter } from 'expo-router'
import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  SectionList,
  Text,
  TextInput,
  View,
} from 'react-native'

import { EmptyTasks } from '../../components/EmptyTasks'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { TaskListSkeleton } from '../../components/Skeleton'
import { PageHeading } from '../../components/PageHeading'
import { SearchIcon } from '../../components/icons'
import { RowAction, RowMenu, TaskRow } from '../../components/TaskRow'
import { useToast } from '../../components/ToastProvider'
import { usePersistedState } from '../../hooks/usePersistedState'
import { usePullRefresh } from '../../hooks/usePullRefresh'

type Sort = 'CHRON' | 'TOP'

type Group = {
  key: string
  label: string
  eyebrow: string
  overdueSuffix: string | null
  // TOP-sort groups render as web's inline Separator (label + hairline, no
  // count) — or nothing at all for the leading run.
  separator?: boolean
  data: Task[]
}

const OVERDUE = '#fb7185'

export default function TasksList() {
  const router = useRouter()
  const [sort, setSort] = usePersistedState<Sort>('dtn.tasks.sort', 'CHRON')
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const doneMutation = useCompleteTask()
  const createMutation = useCreateTask()
  const toast = useToast()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const unsnoozeMutation = useUnsnoozeTask()
  const timer = useTaskTimer()

  const allData = sort === 'CHRON' ? allTasks.data : topTasks.data
  const onComplete = useCallback(
    (id: string) => {
      const t = (allData ?? []).find((x) => x.id === id)
      if (!t) {
        doneMutation.mutate({ id, countMeasurement: true })
        return
      }
      const now = new Date()
      if (isCompletionGated(t, now)) return
      if (willAdvanceSubtask(t, now)) {
        doneMutation.mutate({ id, countMeasurement: true })
        return
      }
      const kind = completionConfirmKind(t, now)
      if (!kind) {
        doneMutation.mutate({ id, countMeasurement: true })
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
  // Rows show un-opened tasks, so Snooze pushes the whole task out rather than
  // just its next subtask, which isn't visible here. Subtask-level snoozing
  // lives in the Focus View.
  const onSnooze = useCallback(
    (id: string) =>
      snoozeMutation.mutate(
        { id, allSubtasks: true },
        {
          onSuccess: () =>
            toast({
              message: 'Task snoozed',
              actionLabel: 'Undo',
              onAction: () => unsnoozeMutation.mutate(id),
            }),
        },
      ),
    [snoozeMutation, unsnoozeMutation, toast],
  )
  const onWake = useCallback(
    (id: string) => unsnoozeMutation.mutate(id),
    [unsnoozeMutation],
  )
  const onDelete = useCallback(
    (id: string, title: string) => {
      Alert.alert(
        'Delete task',
        `Are you sure you want to delete '${title}'?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              // Snapshot for Undo — recreate restores content + subtasks (new id).
              const task = [
                ...(allTasks.data ?? []),
                ...(topTasks.data ?? []),
              ].find((x) => x.id === id)
              const restore = task ? taskToInput(task) : null
              deleteMutation.mutate(id, {
                onSuccess: () => {
                  if (!restore) return
                  toast({
                    message: `Deleted '${title}'`,
                    actionLabel: 'Undo',
                    onAction: () => createMutation.mutate(restore),
                  })
                },
              })
            },
          },
        ],
      )
    },
    [deleteMutation, createMutation, toast, allTasks.data, topTasks.data],
  )

  const sections: Group[] = useMemo(() => {
    const today0 = startOfToday()
    let tasks =
      sort === 'CHRON' ? [...(allTasks.data ?? [])] : [...(topTasks.data ?? [])]
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
        (a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
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

    // Mirror web: keep the exact sortTasks ranking as ONE flat list and
    // only mark the first-occurrence boundaries with inline separators —
    // never re-bucket (that could reorder tasks vs their rank).
    sortTasks(tasks, today0)
    const now = new Date()
    const marks = new Map<number, string>()
    const firstAfter = tasks.findIndex((t) => newSafeDate(t.due) > now)
    if (firstAfter >= 0) marks.set(firstAfter, 'Due after today')
    const firstSnoozed = tasks.findIndex(
      (t) => t.snooze && new Date(t.snooze) > now,
    )
    // Both boundaries can land on one index (first future-due task is also
    // the first snoozed one); web stacks two separators there — SectionList
    // has one header per section, so join the labels instead of dropping one.
    if (firstSnoozed >= 0)
      marks.set(
        firstSnoozed,
        marks.has(firstSnoozed)
          ? `${marks.get(firstSnoozed)} · Snoozed`
          : 'Snoozed',
      )
    const starts = Array.from(new Set([0, ...marks.keys()])).sort(
      (a, b) => a - b,
    )
    const result: Group[] = []
    starts.forEach((s, j) => {
      const end = starts[j + 1] ?? tasks.length
      if (end <= s) return
      result.push({
        key: `top-${s}`,
        label: marks.get(s) ?? '',
        eyebrow: '',
        overdueSuffix: null,
        separator: true,
        data: tasks.slice(s, end),
      })
    })
    return result
  }, [sort, allTasks.data, topTasks.data, query])

  // Count what's on screen — like web, the eyebrow reflects the current
  // search filter, not the raw backlog.
  const eyebrow = useMemo(
    () => tasksListEyebrow(sections.flatMap((s) => s.data)),
    [sections],
  )

  // Starting a task selects it server-side, so Home flips to its Focus View
  // and any timer running elsewhere is paused — one task, one timer.
  const onStart = useCallback(
    (t: Task) => {
      timer.mutate({ id: t.id, action: { kind: 'start' } })
      router.replace('/')
    },
    [timer, router],
  )

  // Rows carry their actions inline, exactly as on web: Start commits to the
  // task, Snooze (or Wake) acts in place, and everything else sits behind ⋯.
  const renderItem = useCallback(
    ({ item }: { item: Task }) => {
      const gated = isCompletionGated(item, new Date())
      return (
        <View style={{ marginBottom: 6, paddingHorizontal: 20 }}>
          <TaskRow
            task={item}
            actions={
              <>
                <RowAction label="Start" onPress={() => onStart(item)} />
                {isSnoozed(item) ? (
                  <RowAction label="Wake" onPress={() => onWake(item.id)} />
                ) : (
                  <RowAction label="Snooze" onPress={() => onSnooze(item.id)} />
                )}
                <RowMenu
                  items={[
                    {
                      label: 'Done',
                      onPress: () => onComplete(item.id),
                      disabled: gated,
                    },
                    {
                      label: 'Edit',
                      onPress: () => router.push(`/tasks/${item.id}/edit`),
                    },
                    {
                      label: 'Delete',
                      onPress: () => onDelete(item.id, item.title),
                      danger: true,
                    },
                  ]}
                />
              </>
            }
          />
        </View>
      )
    },
    [onStart, onComplete, onSnooze, onWake, onDelete, router],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: Group }) => <GroupHeader group={section} />,
    [],
  )

  const activeQuery = sort === 'CHRON' ? allTasks : topTasks
  const { refreshing, onRefresh } = usePullRefresh(activeQuery.refetch)

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeading eyebrow={eyebrow}>All tasks</PageHeading>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <SortToggle value={sort} onChange={setSort} />
          </View>
          <Pressable
            onPress={() => {
              if (searchOpen) {
                setSearchOpen(false)
                setQuery('')
              } else {
                setSearchOpen(true)
              }
            }}
            accessibilityRole="button"
            accessibilityState={{ expanded: searchOpen }}
            accessibilityLabel={searchOpen ? 'Close search' : 'Search tasks'}
            style={{
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: searchOpen ? '#27272a' : 'rgba(24,24,27,0.6)',
              borderRadius: 999,
              padding: 11,
            }}
          >
            <SearchIcon color={searchOpen ? '#fafafa' : '#a1a1aa'} />
          </Pressable>
        </View>
        {searchOpen && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: 'rgba(24,24,27,0.5)',
              borderRadius: 999,
              paddingHorizontal: 16,
            }}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Search title or #tag…"
              placeholderTextColor="#52525b"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search tasks by title or tag"
              style={{
                flex: 1,
                paddingVertical: 12,
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 15,
                color: '#fafafa',
              }}
            />
            {query !== '' && (
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
              >
                <Text style={{ color: '#71717a', fontSize: 15 }}>✕</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
      <SectionList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        sections={sections}
        keyExtractor={(t) => t.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListFooterComponent={
          activeQuery.isFetching && sections.length > 0 ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <Loading />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fafafa"
            colors={['#fafafa']}
          />
        }
        ListEmptyComponent={
          activeQuery.isPending ? (
            <TaskListSkeleton rows={6} />
          ) : activeQuery.isError ? (
            <View style={{ marginTop: 40 }}>
              <ErrorState
                message="Couldn't load your tasks."
                onRetry={() => activeQuery.refetch()}
              />
            </View>
          ) : query ? (
            <Text
              style={{
                textAlign: 'center',
                marginTop: 40,
                color: '#71717a',
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {`No tasks match "${query.trim()}"`}
            </Text>
          ) : (
            <View style={{ marginTop: 48 }}>
              <EmptyTasks
                title="No tasks yet"
                subtitle="Create your first task to get started."
                onNewTask={() => router.push('/new-task')}
              />
            </View>
          )
        }
      />
    </View>
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
                fontSize: 14,
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
  // TOP-sort separators mirror web: the leading run has no header at all;
  // boundary runs get label + hairline, uppercase heading style, no count.
  if (group.separator) {
    if (group.label === '') return null
    return (
      <View
        style={{
          paddingHorizontal: 20,
          marginTop: 12,
          marginBottom: 4,
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            fontSize: 16,
            color: '#f4f4f5',
            letterSpacing: 2.3,
            textTransform: 'uppercase',
          }}
        >
          {group.label}
        </Text>
        <View
          style={{
            flex: 1,
            height: 1,
            backgroundColor: '#18181b',
            marginBottom: 4,
          }}
        />
      </View>
    )
  }
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
              fontSize: 11,
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
            fontSize: 15,
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
        style={{
          flex: 1,
          height: 1,
          backgroundColor: '#18181b',
          marginBottom: 6,
        }}
      />
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 12,
          color: '#52525b',
        }}
      >
        {group.data.length}
      </Text>
    </View>
  )
}
