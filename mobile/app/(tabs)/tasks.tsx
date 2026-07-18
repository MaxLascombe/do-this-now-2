import { startOfToday } from '@dtn/shared/day-index'
import { dueGroupLabel, tasksListEyebrow } from '@dtn/shared/format'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
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
import { SafeAreaView } from 'react-native-safe-area-context'

import { EmptyTasks } from '../../components/EmptyTasks'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { PageHeading } from '../../components/PageHeading'
import { RowAction, RowMenu, TaskRow } from '../../components/TaskRow'
import { TopProgress } from '../../components/TopProgress'
import { useToast } from '../../components/ToastProvider'
import { usePersistedState } from '../../hooks/usePersistedState'
import { usePullRefresh } from '../../hooks/usePullRefresh'

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
  const [sort, setSort] = usePersistedState<Sort>('dtn.tasks.sort', 'CHRON')
  const [query, setQuery] = useState('')
  const [quickTitle, setQuickTitle] = useState('')

  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const doneMutation = useCompleteTask()
  const createMutation = useCreateTask()
  const toast = useToast()
  const quickAdd = () => {
    const title = quickTitle.trim()
    if (!title || createMutation.isPending) return
    createMutation.mutate({
      title,
      emoji: '📝',
      due: dateString(new Date()),
      dueTime: null,
      strictDeadline: false,
      canDoEarly: true,
      repeat: 'No Repeat',
      repeatInterval: 1,
      repeatUnit: 'day',
      repeatWeekdays: [false, false, false, false, false, false, false],
      timeFrame: 30,
      timekeeperId: null,
      timeframeType: 'fluid',
      subtasks: [],
      tags: [],
    })
    setQuickTitle('')
  }
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const unsnoozeMutation = useUnsnoozeTask()
  const timer = useTaskTimer()

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
      Alert.alert('Delete task', `Delete '${title}'?`, [
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
      ])
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
  }, [sort, allTasks.data, topTasks.data, query])

  const eyebrow = useMemo(
    () =>
      tasksListEyebrow(
        sort === 'CHRON' ? (allTasks.data ?? []) : (topTasks.data ?? []),
      ),
    [sort, allTasks.data, topTasks.data],
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
        <View style={{ marginBottom: 6 }}>
          <TaskRow
            task={item}
            actions={
              <>
                <RowAction label="Start" primary onPress={() => onStart(item)} />
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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopProgress />
      <PageHeading eyebrow={eyebrow}>All tasks</PageHeading>
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}>
        <SortToggle value={sort} onChange={setSort} />
        <TextInput
          value={quickTitle}
          onChangeText={setQuickTitle}
          onSubmitEditing={quickAdd}
          blurOnSubmit={false}
          placeholder="＋ Add a task…"
          placeholderTextColor="#52525b"
          returnKeyType="done"
          accessibilityLabel="Quick-add a task"
          style={{
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: 'rgba(24,24,27,0.5)',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 14,
            color: '#fafafa',
          }}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search title or #tag…"
          placeholderTextColor="#52525b"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
          accessibilityLabel="Search tasks by title or tag"
          style={{
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: 'rgba(24,24,27,0.5)',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 9,
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 14,
            color: '#fafafa',
          }}
        />
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
            refreshing={refreshing}
            onRefresh={onRefresh}
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
            query ? (
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
