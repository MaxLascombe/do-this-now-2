import {
  findNextActionableSubtask,
  isSnoozed,
} from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  useCompleteTask,
  useDeleteTask,
  useSnoozeTask,
  useTask,
  useTopTasks,
} from '@dtn/shared/queries'
import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { minutesToHours } from '@dtn/shared/time'
import {
  completionConfirmKind,
  confirmMessage,
  currentTimerSeconds,
  isCompletionGated,
} from '@dtn/shared/timer-utils'
import { type Task } from '@dtn/shared/types'
import { Stack, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { SwipeableTaskRow } from '../../components/SwipeableTaskRow'
import { TimerWidget } from '../../components/TimerWidget'
import { TopProgress } from '../../components/TopProgress'

const OVERDUE_ROSE = '#fb7185'

export default function Home() {
  const router = useRouter()
  const topTasks = useTopTasks()
  const tasks = (topTasks.data ?? []).filter((t) => !isSnoozed(t)).slice(0, 3)

  const [selectedIndex, setSelectedIndex] = useState(0)
  const safeIndex = Math.min(selectedIndex, Math.max(0, tasks.length - 1))
  const focused = tasks[safeIndex]

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()

  const onComplete = (id: string) => {
    const t = tasks.find((x) => x.id === id)
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

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopProgress />
      {topTasks.isPending || deleteMutation.isPending ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loading />
        </View>
      ) : tasks.length === 0 ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          {topTasks.isError ? (
            <ErrorState
              message="Couldn't load your tasks."
              onRetry={() => topTasks.refetch()}
            />
          ) : (
            <Text style={{ color: '#a1a1aa', fontSize: 14 }}>
              No tasks for now — tap + to add one.
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={topTasks.isFetching && !topTasks.isPending}
              onRefresh={() => topTasks.refetch()}
              tintColor="#fafafa"
              colors={['#fafafa']}
            />
          }
        >
          {focused && (
            <Hero
              task={focused}
              index={safeIndex}
              total={tasks.length}
              onComplete={() => onComplete(focused.id)}
              onSnooze={() => onSnooze(focused.id)}
              onEdit={() => router.push(`/tasks/${focused.id}/edit`)}
              onDelete={() => onDelete(focused.id, focused.title)}
            />
          )}
          {tasks.length > 1 && (
            <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 10,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: '#52525b',
                  marginBottom: 8,
                  paddingHorizontal: 4,
                }}
              >
                up next
              </Text>
            </View>
          )}
          {tasks.map((t, i) =>
            i === safeIndex ? null : (
              <SwipeableTaskRow
                key={t.id}
                task={t}
                onPress={() => setSelectedIndex(i)}
                onComplete={() => onComplete(t.id)}
                onSnooze={() => onSnooze(t.id)}
                onEdit={() => router.push(`/tasks/${t.id}/edit`)}
                onDelete={() => onDelete(t.id, t.title)}
              />
            ),
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function Hero({
  task,
  index,
  total,
  onComplete,
  onSnooze,
  onEdit,
  onDelete,
}: {
  task: Task
  index: number
  total: number
  onComplete: () => void
  onSnooze: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const nextSub =
    task.subtasks.length > 0
      ? findNextActionableSubtask(task.subtasks, new Date())
      : undefined
  const doneCount = task.subtasks.filter((s) => s.done).length
  const titleText = nextSub?.title ?? task.title
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )

  // Tick once a second while the timer is running so the gate state
  // updates without the user touching the screen.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!task.timerStartedAt) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [task.timerStartedAt])
  const gated = isCompletionGated(task, now)
  const remainingMin = gated
    ? Math.ceil((task.timeFrame * 60 - currentTimerSeconds(task, now)) / 60)
    : 0
  const advance = willAdvanceSubtask(task, now)

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
      <Text
        style={{
          textAlign: 'center',
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 2.5,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        Task {index + 1} of {total} · Right now
      </Text>
      <Text
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
        style={{
          textAlign: 'center',
          fontSize: 64,
          lineHeight: 72,
          marginTop: 16,
        }}
      >
        {task.emoji}
      </Text>
      <Text
        style={{
          textAlign: 'center',
          fontFamily: 'InstrumentSerif_400Regular_Italic',
          fontSize: 42,
          lineHeight: 46,
          color: '#fafafa',
          marginTop: 12,
        }}
      >
        {titleText}
      </Text>
      {nextSub && (
        <Text
          style={{
            textAlign: 'center',
            marginTop: 12,
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 12,
            color: '#a1a1aa',
          }}
        >
          part of{' '}
          <Text
            style={{
              fontFamily: 'InstrumentSerif_400Regular_Italic',
              fontSize: 14,
            }}
          >
            {task.title}
          </Text>{' '}
          <Text style={{ color: '#52525b' }}>·</Text>{' '}
          <Text style={{ color: '#fafafa' }}>
            {doneCount}/{task.subtasks.length}
          </Text>
        </Text>
      )}

      <View
        style={{
          marginTop: 16,
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {dueLabel && <Chip>{dueLabel}</Chip>}
        {task.timeFrame ? <Chip>{minutesToHours(task.timeFrame)}</Chip> : null}
        {repeatLabel && <Chip>↻ {repeatLabel}</Chip>}
      </View>

      <Pressable
        onPress={onComplete}
        disabled={gated}
        accessibilityRole="button"
        accessibilityState={{ disabled: gated }}
        style={({ pressed }) => ({
          marginTop: 24,
          paddingVertical: 14,
          borderRadius: 999,
          opacity: gated ? 0.4 : 1,
          backgroundColor: pressed ? '#e4e4e7' : '#fafafa',
          alignItems: 'center',
          shadowColor: '#fff',
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 0 },
        })}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            color: '#0a0a0a',
            fontSize: 16,
            letterSpacing: 0.5,
          }}
        >
          {gated ? `${remainingMin} min to go` : advance ? 'Subtask Done' : 'Complete'}
        </Text>
      </Pressable>

      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          gap: 8,
        }}
      >
        <Ghost label="Snooze" glyph="◑" onPress={onSnooze} />
        <Ghost label="Edit" glyph="✎" onPress={onEdit} />
        <Ghost label="Delete" glyph="✕" onPress={onDelete} danger />
      </View>

      <View style={{ marginTop: 20 }}>
        <HeroTimer task={task} />
      </View>
    </View>
  )
}

function HeroTimer({ task }: { task: Task }) {
  const keeperQuery = useTask(task.timekeeperId ?? '')
  const timerTask = task.timekeeperId ? keeperQuery.data : task
  if (!timerTask) return null
  return (
    <TimerWidget
      task={timerTask}
      actionId={task.id}
      plannedMinutes={timerTask.timeFrame}
      compact
    />
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.8)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 12,
          color: '#a1a1aa',
        }}
      >
        {children}
      </Text>
    </View>
  )
}

function Ghost({
  label,
  glyph,
  onPress,
  danger,
}: {
  label: string
  glyph: string
  onPress: () => void
  danger?: boolean
}) {
  const color = danger ? OVERDUE_ROSE : '#d4d4d8'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: danger ? 'rgba(251,113,133,0.3)' : '#27272a',
        borderRadius: 999,
        backgroundColor: pressed ? 'rgba(255,255,255,0.04)' : 'transparent',
      })}
    >
      <Text style={{ color, fontSize: 14 }}>{glyph}</Text>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          color,
          fontSize: 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
