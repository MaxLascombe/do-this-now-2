import { findNextActionableSubtask, isSnoozed } from '@dtn/shared/task-sorting'
import {
  snoozeTaskTransition,
  willAdvanceSubtask,
} from '@dtn/shared/task-transitions'
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useExitFocus,
  useSelection,
  useSnoozeManyTasks,
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

import { EmptyTasks } from '../../components/EmptyTasks'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton, TaskRowSkeleton } from '../../components/Skeleton'
import { RowAction, RowMenu, TaskRow } from '../../components/TaskRow'
import { TimerWidget } from '../../components/TimerWidget'
import { useToast } from '../../components/ToastProvider'
import { usePullRefresh } from '../../hooks/usePullRefresh'

export default function Home() {
  const router = useRouter()
  const topTasks = useTopTasks()
  const selection = useSelection()
  const unselectMutation = useUnselect()
  const timer = useTaskTimer()
  const updateTask = useUpdateTask()

  // The authoritative Selected Task turns Home into the single-task Focus
  // View — same as web. Selection is rank-independent, so the task may not be
  // in the top list; fall back to a direct fetch when it isn't.
  const serverSelectedId = selection.data?.selectedTaskId ?? null
  const fetchedSelected = useTask(serverSelectedId ?? '')
  const focusTask = serverSelectedId
    ? ((topTasks.data ?? []).find((t) => t.id === serverSelectedId) ??
      fetchedSelected.data ??
      null)
    : null

  const activeTasks = (topTasks.data ?? []).filter((t) => !isSnoozed(t))
  const topThree = activeTasks.slice(0, 3)

  const doneMutation = useCompleteTask()
  const exitFocus = useExitFocus()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const snoozeManyMutation = useSnoozeManyTasks()
  const unsnoozeMutation = useUnsnoozeTask()
  const createMutation = useCreateTask()
  const toast = useToast()

  // True when `t` is the one currently held open in the Focus View — so a
  // terminal action on it should also step out of that view.
  const isFocusTask = (t: Task) => !!focusTask && t.id === focusTask.id

  // A full completion takes the task out of the active list; drop the Focus
  // View pointer up front so the view exits the instant Done fires (the server
  // clears its own pointer in the same completion transaction).
  const runComplete = (t: Task, countMeasurement: boolean) => {
    if (isFocusTask(t)) exitFocus()
    doneMutation.mutate({ id: t.id, countMeasurement })
  }

  const completeFor = (t: Task) => {
    const now = new Date()
    if (isCompletionGated(t, now)) return
    // Subtask advance keeps the task in the Focus View so the next subtask can
    // be worked — don't exit or fire the count/skip confirm.
    if (willAdvanceSubtask(t, now)) {
      doneMutation.mutate({ id: t.id, countMeasurement: true })
      return
    }
    const kind = completionConfirmKind(t, now)
    if (!kind) {
      runComplete(t, true)
      return
    }
    Alert.alert('Count this time?', confirmMessage(t, now, kind), [
      { text: 'Cancel', style: 'cancel' },
      {
        text: "Don't count",
        onPress: () => runComplete(t, false),
      },
      {
        text: 'Count it',
        onPress: () => runComplete(t, true),
      },
    ])
  }

  // A row shows an un-opened task, so its Snooze pushes the whole task out —
  // snoozing just the next subtask makes no sense when it isn't on screen.
  // The Focus View, where the subtask is visible, keeps the subtask-aware one.
  const snoozeFor = (t: Task, wholeTask: boolean) => {
    // Snoozing the whole task out of the active list also leaves the Focus
    // View — mirror the server's pointer-clear so the view exits at once. A
    // lone subtask snooze that keeps the task active stays in the view.
    if (isFocusTask(t)) {
      const { nextTask } = snoozeTaskTransition(t, wholeTask, new Date())
      if (isSnoozed(nextTask)) exitFocus()
    }
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

  // "Clear my plate from here down" — snooze this task and every task ranked
  // after it. Spans the whole ranked list, not just the three visible rows.
  const snoozeFromHere = (index: number) => {
    const ids = activeTasks.slice(index).map((t) => t.id)
    if (ids.length === 0) return
    snoozeManyMutation.mutate(ids, {
      onSuccess: (res) =>
        toast({
          message: `Snoozed ${res.count} task${res.count === 1 ? '' : 's'}`,
        }),
    })
  }

  const deleteFor = (t: Task) => {
    Alert.alert(
      'Delete task',
      `Are you sure you want to delete '${t.title}'?`,
      [
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
      ],
    )
  }

  // Starting a task's timer selects it server-side, so Home flips to the Focus
  // View and any timer running elsewhere is paused — one task, one timer.
  const startFor = (t: Task) => {
    timer.mutate({ id: t.id, action: { kind: 'start' } })
  }

  // Return: step off the Selected Task (pauses its timer, clears the pointer).
  const returnAction = () => unselectMutation.mutate()

  const snoozeAllSubtasks = (t: Task) => {
    if (isFocusTask(t)) {
      const { nextTask } = snoozeTaskTransition(t, true, new Date())
      if (isSnoozed(nextTask)) exitFocus()
    }
    snoozeMutation.mutate(
      { id: t.id, allSubtasks: true },
      {
        onSuccess: () =>
          toast({
            message: 'Subtasks snoozed',
            actionLabel: 'Undo',
            onAction: () => unsnoozeMutation.mutate(t.id),
          }),
      },
    )
  }

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

  const isBusy = topTasks.isPending || deleteMutation.isPending
  const { refreshing, onRefresh } = usePullRefresh(topTasks.refetch)

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ headerShown: false }} />
      {isBusy ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Loading your tasks"
          style={{ flex: 1, justifyContent: 'center' }}
        >
          <View style={{ paddingHorizontal: 20 }}>
            <Skeleton
              style={{ height: 12, width: 80, marginBottom: 16, marginLeft: 4 }}
            />
          </View>
          <View style={{ gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ paddingHorizontal: 20 }}>
                <TaskRowSkeleton />
              </View>
            ))}
          </View>
        </View>
      ) : !focusTask && topThree.length === 0 ? (
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
              onViewAll={() => router.push('/tasks')}
            />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: 24,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
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
              onSnoozeSubtasks={() => snoozeAllSubtasks(focusTask)}
              onEdit={() => router.push(`/tasks/${focusTask.id}/edit`)}
              onDelete={() => deleteFor(focusTask)}
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
                  marginBottom: 16,
                  paddingHorizontal: 4,
                }}
              >
                what&apos;s next
              </Text>
              <View style={{ gap: 8 }}>
                {topThree.map((t, i) => {
                  const gated = isCompletionGated(t, new Date())
                  return (
                    <TaskRow
                      key={t.id}
                      task={t}
                      rank={i + 1}
                      actions={
                        <>
                          <RowAction
                            label="Start"
                            onPress={() => startFor(t)}
                          />
                          <RowAction
                            label="Snooze"
                            onPress={() => snoozeFor(t, true)}
                          />
                          <RowMenu
                            items={[
                              {
                                label: 'Done',
                                onPress: () => completeFor(t),
                                disabled: gated,
                              },
                              {
                                label: 'Snooze this and after',
                                onPress: () => snoozeFromHere(i),
                              },
                              {
                                label: 'Edit',
                                onPress: () =>
                                  router.push(`/tasks/${t.id}/edit`),
                              },
                              {
                                label: 'Delete',
                                onPress: () => deleteFor(t),
                                danger: true,
                              },
                            ]}
                          />
                        </>
                      }
                    />
                  )
                })}
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  )
}

// The Focus View: the single Selected Task.
function Hero({
  task,
  onReturn,
  onComplete,
  onSnooze,
  onSnoozeSubtasks,
  onEdit,
  onDelete,
  onToggleSubtask,
}: {
  task: Task
  onReturn: () => void
  onComplete: () => void
  onSnooze: () => void
  onSnoozeSubtasks: () => void
  onEdit: () => void
  onDelete: () => void
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

  // Tick once a second while the timer runs so the Done gate re-evaluates
  // without the user touching the screen.
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
          letterSpacing: 2,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        Right now
      </Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          textAlign: 'center',
          fontSize: 80,
          lineHeight: 88,
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
          lineHeight: 44,
          letterSpacing: -0.6,
          maxWidth: 320,
          alignSelf: 'center',
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
              fontSize: 17,
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
          marginTop: 32,
          width: '100%',
          maxWidth: 320,
          alignSelf: 'center',
          paddingVertical: 14,
          borderRadius: 999,
          opacity: gated ? 0.4 : 1,
          backgroundColor: pressed ? '#e4e4e7' : '#fff',
          alignItems: 'center',
          shadowColor: '#fff',
          shadowOpacity: 0.1,
          shadowRadius: 40,
          shadowOffset: { width: 0, height: 0 },
        })}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_600SemiBold',
            color: '#000',
            fontSize: 18,
          }}
        >
          {gated
            ? `${remainingMin} min to go`
            : advance
              ? 'Subtask Done'
              : 'Done'}
        </Text>
      </Pressable>

      {/* The same five secondary actions web's Focus View shows, in web's
          borderless three-up grid under the Done button. */}
      <View
        style={{
          marginTop: 12,
          width: '100%',
          maxWidth: 320,
          alignSelf: 'center',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          columnGap: 8,
          rowGap: 8,
        }}
      >
        <Ghost label="Return" onPress={onReturn} />
        <Ghost label="Snooze" onPress={onSnooze} />
        {task.subtasks.length > 0 && (
          <Ghost label="Snooze subtasks" onPress={onSnoozeSubtasks} />
        )}
        <Ghost label="Edit" onPress={onEdit} />
        <Ghost label="Delete" onPress={onDelete} />
      </View>

      <View style={{ marginTop: 24 }}>
        <HeroTimer task={task} />
      </View>

      {task.subtasks.length > 0 && (
        <View style={{ marginTop: 32, gap: 4 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 10,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: '#71717a',
              }}
            >
              Subtasks
            </Text>
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 10,
                letterSpacing: 3,
                color: '#71717a',
              }}
            >
              {doneCount}/{task.subtasks.length}
            </Text>
          </View>
          {task.subtasks.map((s, i) => (
            <Pressable
              key={i}
              onPress={() => onToggleSubtask(i)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: s.done }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: '#27272a',
                borderRadius: 12,
                paddingHorizontal: 16,
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
                  fontSize: 14,
                  color: s.done ? '#71717a' : '#f4f4f5',
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
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 999,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 14,
          color: '#a1a1aa',
        }}
      >
        {children}
      </Text>
    </View>
  )
}

function Ghost({ label, onPress }: { label: string; onPress: () => void }) {
  // Web's SecondaryAction, minus its leading Kbd chip — those are keyboard
  // hints, meaningless on touch. Borderless, muted zinc-500 (Delete included,
  // as on web), background only on press. One cell of the three-up grid
  // (flexBasis ~1/3 leaves room for the two 8px column gaps).
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexBasis: '31%',
        flexGrow: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: pressed ? '#18181b' : 'transparent',
      })}
    >
      {({ pressed }) => (
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 14,
            color: pressed ? '#f4f4f5' : '#71717a',
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}
