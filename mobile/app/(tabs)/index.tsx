import {
  findNextActionableSubtask,
  isSnoozed,
} from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useSelection,
  useSnoozeTask,
  useTask,
  useTaskTimer,
  useTopTasks,
  useUnselect,
  useUnsnoozeTask,
  useUpdateTask,
} from '@dtn/shared/queries'
import { taskToInput } from '@dtn/shared/task-input'
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

import { EmptyTasks } from '../../components/EmptyTasks'
import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { TimerWidget } from '../../components/TimerWidget'
import { TopProgress } from '../../components/TopProgress'
import { useToast } from '../../components/ToastProvider'

const OVERDUE_ROSE = '#fb7185'

export default function Home() {
  const router = useRouter()
  const topTasks = useTopTasks()
  const selection = useSelection()
  const unselectMutation = useUnselect()
  const timer = useTaskTimer()
  const updateTask = useUpdateTask()

  // The authoritative Selected Task turns Home into the single-task Focus
  // View — the same model as web. Selection is rank-independent, so the task
  // may not be in the top list; fall back to a direct fetch when it isn't.
  const serverSelectedId = selection.data?.selectedTaskId ?? null
  const fetchedSelected = useTask(serverSelectedId ?? '')
  const focusTask = serverSelectedId
    ? ((topTasks.data ?? []).find((t) => t.id === serverSelectedId) ??
      fetchedSelected.data ??
      null)
    : null

  const tasks = (topTasks.data ?? []).filter((t) => !isSnoozed(t)).slice(0, 3)

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const unsnoozeMutation = useUnsnoozeTask()
  const createMutation = useCreateTask()
  const toast = useToast()

  const completeFor = (t: Task) => {
    const now = new Date()
    if (isCompletionGated(t, now)) return
    if (willAdvanceSubtask(t, now)) {
      doneMutation.mutate({ id: t.id })
      return
    }
    const kind = completionConfirmKind(t, now)
    if (!kind) {
      doneMutation.mutate({ id: t.id })
      return
    }
    Alert.alert('Count this time?', confirmMessage(t, now, kind), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: "Don't count",
        onPress: () => doneMutation.mutate({ id: t.id, countMeasurement: false }),
      },
      {
        text: 'Count it',
        onPress: () => doneMutation.mutate({ id: t.id, countMeasurement: true }),
      },
    ])
  }

  // A row shows an un-opened task, so its Snooze pushes the whole task out —
  // snoozing just the next subtask makes no sense when it isn't on screen.
  // The Focus View, where the subtask is visible, keeps the subtask-aware one.
  const snoozeFor = (t: Task, wholeTask: boolean) => {
    snoozeMutation.mutate(
      { id: t.id, allSubtasks: wholeTask },
      {
        onSuccess: (res) =>
          toast({
            message:
              res.scope === 'subtask' ? 'Subtask snoozed' : 'Task snoozed',
            actionLabel: 'Undo',
            onAction: () => unsnoozeMutation.mutate(t.id),
          }),
      },
    )
  }

  const deleteFor = (t: Task) => {
    Alert.alert('Delete task', `Delete '${t.title}'?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const restore = taskToInput(t)
          deleteMutation.mutate(t.id, {
            onSuccess: () =>
              toast({
                message: `Deleted '${t.title}'`,
                actionLabel: 'Undo',
                onAction: () => createMutation.mutate(restore),
              }),
          })
        },
      },
    ])
  }

  // Starting a task's timer selects it server-side, so Home flips to the Focus
  // View and any timer running elsewhere is paused — one task, one timer.
  const startFor = (t: Task) => {
    timer.mutate({ id: t.id, action: { kind: 'start' } })
  }

  // Return: step off the Selected Task (pauses its timer, clears the pointer).
  const returnAction = () => unselectMutation.mutate()

  const toggleSubtask = (index: number) => {
    if (!focusTask) return
    const subtasks = focusTask.subtasks.map((s, i) =>
      i === index ? { ...s, done: !s.done } : s,
    )
    updateTask.mutate({
      id: focusTask.id,
      input: { ...taskToInput(focusTask), subtasks },
    })
  }

  // The overflow menu, as a native action sheet.
  const openMenu = (t: Task, inFocusView: boolean) => {
    const options: Array<{
      text: string
      style?: 'cancel' | 'destructive'
      onPress?: () => void
    }> = []
    if (inFocusView) {
      const gated = isCompletionGated(t, new Date())
      if (!gated) options.push({ text: 'Done', onPress: () => completeFor(t) })
      if (t.subtasks.length > 0) {
        options.push({
          text: 'Snooze subtasks',
          onPress: () => snoozeFor(t, true),
        })
      }
    } else {
      const gated = isCompletionGated(t, new Date())
      if (!gated) options.push({ text: 'Done', onPress: () => completeFor(t) })
    }
    options.push({
      text: 'Edit',
      onPress: () => router.push(`/tasks/${t.id}/edit`),
    })
    options.push({
      text: 'Delete',
      style: 'destructive',
      onPress: () => deleteFor(t),
    })
    options.push({ text: 'Cancel', style: 'cancel' })
    Alert.alert(t.title, undefined, options)
  }

  const isBusy = topTasks.isPending || deleteMutation.isPending

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopProgress />
      {isBusy ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loading />
        </View>
      ) : !focusTask && tasks.length === 0 ? (
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
            <EmptyTasks
              title="Nothing to do right now"
              subtitle="You're all caught up. Add a task to line up what's next."
              onNewTask={() => router.push('/new-task')}
            />
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
          {focusTask ? (
            <Hero
              task={focusTask}
              onReturn={returnAction}
              onComplete={() => completeFor(focusTask)}
              onSnooze={() => snoozeFor(focusTask, false)}
              onMore={() => openMenu(focusTask, true)}
              onToggleSubtask={toggleSubtask}
            />
          ) : (
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 10,
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                  color: '#52525b',
                  marginBottom: 12,
                  paddingHorizontal: 4,
                }}
              >
                what's next
              </Text>
              <View style={{ gap: 8 }}>
                {tasks.map((t, i) => (
                  <TopTaskRow
                    key={t.id}
                    task={t}
                    rank={i + 1}
                    onStart={() => startFor(t)}
                    onSnooze={() => snoozeFor(t, true)}
                    onMore={() => openMenu(t, false)}
                  />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// One of the top tasks when nothing is selected. Start commits to it (starts
// its timer → Focus View); Snooze and the ⋯ menu act on it in place.
function TopTaskRow({
  task,
  rank,
  onStart,
  onSnooze,
  onMore,
}: {
  task: Task
  rank: number
  onStart: () => void
  onSnooze: () => void
  onMore: () => void
}) {
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const subtaskCount = task.subtasks.length
  const doneCount = task.subtasks.filter((s) => s.done).length

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 13,
            color: '#52525b',
            width: 14,
            textAlign: 'center',
          }}
        >
          {rank}
        </Text>
        <Text style={{ fontSize: 24, lineHeight: 30 }}>{task.emoji}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 16,
              color: '#f4f4f5',
            }}
          >
            {task.title}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 3,
            }}
          >
            {dueLabel ? <Meta>{dueLabel}</Meta> : null}
            {task.timeFrame ? (
              <Meta>{minutesToHours(task.timeFrame)}</Meta>
            ) : null}
            {subtaskCount > 0 ? (
              <Meta>
                ☐ {doneCount}/{subtaskCount}
              </Meta>
            ) : null}
          </View>
        </View>
      </View>

      {/* Actions sit under the text, like the web rows on a narrow screen. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <RowButton label="Start" onPress={onStart} primary />
        <RowButton label="Snooze" onPress={onSnooze} />
        <RowButton label="⋯" onPress={onMore} accessibilityLabel="More actions" />
      </View>
    </View>
  )
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 11,
        color: '#71717a',
      }}
    >
      {children}
    </Text>
  )
}

function RowButton({
  label,
  onPress,
  primary,
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  primary?: boolean
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => ({
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: primary ? '#fafafa' : '#27272a',
        backgroundColor: primary
          ? pressed
            ? '#e4e4e7'
            : '#fafafa'
          : pressed
            ? 'rgba(255,255,255,0.06)'
            : 'transparent',
      })}
    >
      <Text
        style={{
          fontFamily: primary
            ? 'JetBrainsMono_700Bold'
            : 'JetBrainsMono_400Regular',
          fontSize: 12,
          color: primary ? '#0a0a0a' : '#a1a1aa',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

// The Focus View: the single Selected Task.
function Hero({
  task,
  onReturn,
  onComplete,
  onSnooze,
  onMore,
  onToggleSubtask,
}: {
  task: Task
  onReturn: () => void
  onComplete: () => void
  onSnooze: () => void
  onMore: () => void
  onToggleSubtask: (index: number) => void
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
        Right now
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
          {gated
            ? `${remainingMin} min to go`
            : advance
              ? 'Subtask Done'
              : 'Complete'}
        </Text>
      </Pressable>

      <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
        <Ghost label="Return" glyph="↩" onPress={onReturn} />
        <Ghost label="Snooze" glyph="◑" onPress={onSnooze} />
        <Ghost label="More" glyph="⋯" onPress={onMore} />
      </View>

      <View style={{ marginTop: 20 }}>
        <HeroTimer task={task} />
      </View>

      {task.subtasks.length > 0 && (
        <View style={{ marginTop: 24, gap: 6 }}>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 10,
              letterSpacing: 2.5,
              textTransform: 'uppercase',
              color: '#71717a',
            }}
          >
            Subtasks {doneCount}/{task.subtasks.length}
          </Text>
          {task.subtasks.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => onToggleSubtask(i)}
              accessibilityRole="button"
              accessibilityState={{ checked: s.done }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                borderWidth: 1,
                borderColor: '#27272a',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: pressed
                  ? 'rgba(255,255,255,0.04)'
                  : 'rgba(24,24,27,0.6)',
              })}
            >
              <Text style={{ color: s.done ? '#34d399' : '#52525b' }}>
                {s.done ? '☑' : '☐'}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 13,
                  color: s.done ? '#71717a' : '#d4d4d8',
                  textDecorationLine: s.done ? 'line-through' : 'none',
                }}
              >
                {s.title}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
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
      <Text style={{ color, fontSize: 13 }}>{glyph}</Text>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 13,
          color,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
