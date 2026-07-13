import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  usePrefetchTask,
  usePrimeTaskCache,
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
import {
  findNextActionableSubtask,
  isSnoozed,
} from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import { minutesToHours } from '@dtn/shared/time'
import {
  completionConfirmKind,
  currentTimerSeconds,
  isCompletionGated,
} from '@dtn/shared/timer-utils'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useConfirm } from '../components/ConfirmProvider'
import { CountConfirmModal } from '../components/CountConfirmModal'
import { ErrorState } from '../components/ErrorState'
import { KeyHints } from '../components/KeyHints'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { Skeleton } from '../components/Skeleton'
import { SubtaskList } from '../components/SubtaskList'
import { RowAction, RowMenu, TaskRow } from '../components/TaskRow'
import { TimerWidget } from '../components/TimerWidget'
import { useToast } from '../components/ToastProvider'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { Task } from '@dtn/shared/types'
import type { KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Now · Do This Now' }] }),
  component: Home,
})

const Kbd = ({
  children,
  variant = 'default',
}: {
  children: string
  variant?: 'default' | 'on-light'
}) => (
  <kbd
    className={
      'rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ' +
      (variant === 'on-light'
        ? 'border-zinc-300 bg-black/10 text-zinc-900'
        : 'border-zinc-800 bg-zinc-900 text-zinc-300')
    }
  >
    {children}
  </kbd>
)

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1 text-sm text-zinc-400">
    {children}
  </span>
)

const SecondaryAction = ({
  k,
  label,
  onClick,
}: {
  k: string
  label: string
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-zinc-500 transition-colors hover:bg-zinc-900 hover:text-zinc-100"
  >
    <Kbd>{k}</Kbd>
    <span>{label}</span>
  </button>
)

const EmptyNow = ({
  onNewTask,
  onViewAll,
}: {
  onNewTask: () => void
  onViewAll: () => void
}) => (
  <div className="flex flex-col items-center gap-6 px-6 text-center">
    <span aria-hidden="true" className="text-5xl leading-none select-none">
      ✺
    </span>
    <div className="space-y-1.5">
      <p className="font-mono text-lg text-zinc-200">Nothing to do right now</p>
      <p className="font-mono text-sm text-zinc-500">
        You're all caught up. Add a task to line up what's next.
      </p>
    </div>
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onNewTask}
        className="flex items-center gap-2 rounded-full bg-zinc-50 px-4 py-2 font-mono text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
      >
        <span>New task</span>
        <Kbd variant="on-light">⇧+</Kbd>
      </button>
      <button
        type="button"
        onClick={onViewAll}
        className="rounded-full border border-zinc-800 px-4 py-2 font-mono text-sm text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
      >
        View all tasks
      </button>
    </div>
  </div>
)

function Home() {
  const navigate = useNavigate()
  const topTasksQuery = useTopTasks()
  const selection = useSelection()
  const unselectMutation = useUnselect()

  const tasks = (topTasksQuery.data ?? []).filter((t) => !isSnoozed(t))

  // The authoritative Selected Task turns Home into the single-task Focus
  // View. Selection is rank-independent, so the task may not be in the top
  // list — fall back to a direct fetch when it isn't.
  const serverSelectedId = selection.data?.selectedTaskId ?? null
  const fetchedSelected = useTask(serverSelectedId ?? '')
  const focusTask = serverSelectedId
    ? ((topTasksQuery.data ?? []).find((t) => t.id === serverSelectedId) ??
      fetchedSelected.data ??
      null)
    : null

  // Home has exactly two states. When a task is selected it becomes the
  // single-task Focus View; otherwise we show the top tasks as equal rows.
  // The per-Hero actions below target the Selected Task.
  const selectedTask = focusTask

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const createTask = useCreateTask()
  const snoozeMutation = useSnoozeTask()
  const snoozeManyMutation = useSnoozeManyTasks()
  const unsnoozeMutation = useUnsnoozeTask()
  const updateTask = useUpdateTask()
  const prefetchTask = usePrefetchTask()
  const primeTaskCache = usePrimeTaskCache()
  const confirm = useConfirm()
  const toast = useToast()

  const [pendingComplete, setPendingComplete] = useState<{
    task: Task
    kind: 'over' | 'under'
  } | null>(null)

  // Keyboard cursor over the Top Tasks list. The first row is focused by
  // default; ↑/↓ and the number keys move the ring, Enter selects it.
  const [focusIndex, setFocusIndex] = useState(0)

  const runComplete = (id: string, countMeasurement: boolean) => {
    doneMutation.mutate({ id, countMeasurement })
  }

  const completeTaskFor = (task: Task | null | undefined) => {
    if (!task) return
    const now = new Date()
    if (isCompletionGated(task, now)) return
    // Subtask advance never triggers the count/skip confirm — that
    // dialog is about how to record the *whole task's* timer, which
    // doesn't fire on subtask completion.
    if (willAdvanceSubtask(task, now)) {
      runComplete(task.id, true)
      return
    }
    const kind = completionConfirmKind(task, now)
    if (!kind) {
      runComplete(task.id, true)
      return
    }
    setPendingComplete({ task, kind })
  }
  const completeTaskAction = () => completeTaskFor(selectedTask)

  // A row shows an un-opened task, so its Snooze pushes the *whole* task out
  // — snoozing just the next subtask makes no sense when that subtask isn't
  // on screen. The Focus View, where the subtask is visible, keeps the
  // subtask-aware snooze on `s` (and the whole-task snooze on ⇧S).
  const snoozeTaskFor = (
    task: Task | null | undefined,
    wholeTask: boolean,
  ) => {
    if (!task) return
    const { id } = task
    snoozeMutation.mutate(
      { id, allSubtasks: wholeTask },
      {
        onSuccess: (res) =>
          toast({
            message:
              res.scope === 'subtask' ? 'Subtask snoozed' : 'Task snoozed',
            actionLabel: 'Undo',
            onAction: () => unsnoozeMutation.mutate(id),
          }),
      },
    )
  }
  const snoozeTaskAction = () => snoozeTaskFor(selectedTask, false)

  const snoozeAllSubtasksAction = () => {
    if (!selectedTask) return
    const { id } = selectedTask
    snoozeMutation.mutate(
      { id, allSubtasks: true },
      {
        onSuccess: () =>
          toast({
            message: 'Subtasks snoozed',
            actionLabel: 'Undo',
            onAction: () => unsnoozeMutation.mutate(id),
          }),
      },
    )
  }

  const deleteTaskFor = async (task: Task | null | undefined) => {
    if (!task) return
    const ok = await confirm({
      message: `Are you sure you want to delete '${task.title}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const title = task.title
    const restore = taskToInput(task)
    deleteMutation.mutate(task.id, {
      onSuccess: () =>
        toast({
          message: `Deleted '${title}'`,
          actionLabel: 'Undo',
          onAction: () => createTask.mutate(restore),
        }),
    })
  }
  const deleteTaskAction = () => deleteTaskFor(selectedTask)

  const goEditFor = (task: Task | null | undefined) => {
    if (!task) return
    primeTaskCache(task)
    navigate({ to: '/tasks/$id/edit', params: { id: task.id } })
  }
  const goEdit = () => goEditFor(selectedTask)

  // A 0-time-frame child runs its timer on the keeper row, like HeroTimer —
  // resolve it so the toggle reads the right `running` state. The mutation
  // still targets the selected id; the server maps it to the keeper.
  const timer = useTaskTimer()
  const keeperQuery = useTask(selectedTask?.timekeeperId ?? '')
  const timerTask = selectedTask?.timekeeperId ? keeperQuery.data : selectedTask
  const toggleTimerAction = () => {
    if (!selectedTask) return
    timer.mutate({
      id: selectedTask.id,
      action: { kind: timerTask?.timerStartedAt ? 'pause' : 'start' },
    })
  }

  // Selecting a top task starts its timer. Slice-1 wiring makes the started
  // task the authoritative Selected Task, so Home flips to the Focus View —
  // and any timer that was running elsewhere is paused server-side.
  const selectTaskAction = (task: Task | undefined) => {
    if (!task) return
    primeTaskCache(task)
    timer.mutate({ id: task.id, action: { kind: 'start' } })
  }

  // "Clear my plate from here down": snooze this task and every task ranked
  // after it, an hour out. Spans the whole ranked list, not just the three
  // visible rows, and always pushes whole tasks out (never a lone subtask).
  const snoozeFromHere = (index: number) => {
    const ids = tasks.slice(index).map((t) => t.id)
    if (ids.length === 0) return
    snoozeManyMutation.mutate(ids, {
      onSuccess: (res) =>
        toast({
          message: `Snoozed ${res.count} task${res.count === 1 ? '' : 's'}`,
        }),
    })
  }

  // Tick a subtask of the Selected Task from the Focus View, which is where a
  // task is worked through now that the detail page is gone.
  const toggleSubtaskAction = (index: number) => {
    if (!focusTask) return
    const subtasks = focusTask.subtasks.map((s, i) =>
      i === index ? { ...s, done: !s.done } : s,
    )
    updateTask.mutate({
      id: focusTask.id,
      input: { ...taskToInput(focusTask), subtasks },
    })
  }

  // Return: step off the Selected Task (pauses its timer, clears the pointer).
  const returnAction = () => {
    if (!focusTask) return
    unselectMutation.mutate()
  }

  const topThree = tasks.slice(0, 3)
  // Clamp the cursor to the current list (it can shrink as tasks complete).
  const safeFocus = Math.min(focusIndex, Math.max(topThree.length - 1, 0))
  const focusedTask = topThree[safeFocus]

  const moveFocus = (delta: number) => {
    setFocusIndex((i) =>
      Math.min(Math.max(i + delta, 0), Math.max(topThree.length - 1, 0)),
    )
  }
  const focusRow = (i: number) => {
    if (i < 0 || i >= topThree.length) return
    setFocusIndex(i)
  }

  // Navigation shortcuts work in both Home states.
  const navActions: Array<KeyAction> = [
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    { key: 'a', description: 'Stats', action: () => navigate({ to: '/stats' }) },
    {
      key: '=',
      description: 'New task',
      shift: true,
      action: () => navigate({ to: '/new-task' }),
    },
    { key: 't', description: 'Tasks', action: () => navigate({ to: '/tasks' }) },
  ]

  // Focus View: shortcuts act on the one Selected Task.
  const focusActions: Array<KeyAction> = [
    { key: 'd', description: 'Task done', action: completeTaskAction },
    { key: 's', description: 'Snooze task', action: snoozeTaskAction, shift: false },
    {
      key: 'S',
      description: 'Snooze all subtasks',
      action: snoozeAllSubtasksAction,
      shift: true,
    },
    { key: 'e', description: 'Edit task', action: goEdit },
    {
      key: 'p',
      description: timerTask?.timerStartedAt ? 'Pause timer' : 'Start timer',
      action: toggleTimerAction,
    },
    {
      key: 'backspace',
      description: 'Delete current task',
      action: deleteTaskAction,
    },
    {
      key: 'escape',
      description: 'Return (step off the selected task)',
      action: returnAction,
    },
  ]

  // Top-tasks list: a keyboard cursor. Arrows/numbers move the focus ring;
  // d/s/e act on the focused row in place; Enter selects it (starts its timer
  // → Focus View). Numbers 1–3 are undisplayed fast-jumps for the three rows.
  const listActions: Array<KeyAction> = [
    { key: 'up', description: 'Move focus up', action: () => moveFocus(-1) },
    { key: 'down', description: 'Move focus down', action: () => moveFocus(1) },
    { key: '1', description: 'Focus first task', action: () => focusRow(0) },
    { key: '2', description: 'Focus second task', action: () => focusRow(1) },
    { key: '3', description: 'Focus third task', action: () => focusRow(2) },
    {
      key: 'enter',
      description: 'Select focused task',
      action: () => selectTaskAction(focusedTask),
    },
    {
      key: 'd',
      description: 'Task done',
      action: () => completeTaskFor(focusedTask),
    },
    {
      key: 's',
      description: 'Snooze task',
      action: () => snoozeTaskFor(focusedTask, true),
      shift: false,
    },
    {
      key: 'r',
      description: 'Snooze this task and all after it',
      action: () => snoozeFromHere(safeFocus),
    },
    {
      key: 'e',
      description: 'Edit task',
      action: () => goEditFor(focusedTask),
    },
    {
      key: 'backspace',
      description: 'Delete task',
      action: () => void deleteTaskFor(focusedTask),
    },
  ]

  const keyActions: Array<KeyAction> = [
    ...navActions,
    ...(focusTask ? focusActions : listActions),
  ]
  useKeyAction(keyActions)

  const [sheetOpen, setSheetOpen] = useState(false)

  if (topTasksQuery.isPending) {
    return <NowSkeleton />
  }

  if (deleteMutation.isPending) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loading />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      {focusTask ? (
        <Hero
          task={focusTask}
          onReturn={returnAction}
          onComplete={completeTaskAction}
          onSnooze={snoozeTaskAction}
          onSnoozeSubtasks={snoozeAllSubtasksAction}
          onToggleSubtask={toggleSubtaskAction}
          onEdit={goEdit}
          onDelete={deleteTaskAction}
        />
      ) : tasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-zinc-500">
          {topTasksQuery.isError ? (
            <ErrorState
              message="Couldn't load your tasks."
              onRetry={() => topTasksQuery.refetch()}
            />
          ) : (
            <EmptyNow
              onNewTask={() => navigate({ to: '/new-task' })}
              onViewAll={() => navigate({ to: '/tasks' })}
            />
          )}
        </div>
      ) : (
        // No selection: the top tasks as equal ranked rows. Tapping a row
        // (or Enter on the keyboard-focused row) starts its timer, which
        // selects it and flips Home into the Focus View. Done and Snooze are
        // inline so a row can be cleared without committing to it.
        <div className="flex flex-1 flex-col items-center justify-center px-5 pb-20 md:px-16">
          <div className="w-full max-w-xl">
            <div className="mb-4 px-1 font-mono text-[10px] tracking-[0.25em] text-zinc-600 uppercase">
              what's next
            </div>
            <div className="flex flex-col gap-2">
              {topThree.map((t, i) => {
                // No timer runs while nothing is selected, so a static "now"
                // suffices to tell whether Done is still gated by a target.
                const gated = isCompletionGated(t, new Date())
                return (
                  <TaskRow
                    key={t.id}
                    task={t}
                    rank={i + 1}
                    selected={i === safeFocus}
                    onClick={() => focusRow(i)}
                    onMouseEnter={() => prefetchTask(t.id)}
                    actions={
                      <>
                        <RowAction
                          label="Start"
                          onClick={() => selectTaskAction(t)}
                        />
                        <RowAction
                          label="Snooze"
                          onClick={() => snoozeTaskFor(t, true)}
                        />
                        <RowMenu
                          items={[
                            {
                              label: 'Done',
                              onClick: () => completeTaskFor(t),
                              disabled: gated,
                              title: gated
                                ? 'Run the timer to its target first'
                                : undefined,
                            },
                            {
                              label: 'Snooze this and after',
                              onClick: () => snoozeFromHere(i),
                            },
                            { label: 'Edit', onClick: () => goEditFor(t) },
                            {
                              label: 'Delete',
                              onClick: () => void deleteTaskFor(t),
                              danger: true,
                            },
                          ]}
                        />
                      </>
                    }
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}

      <CountConfirmModal
        open={!!pendingComplete}
        task={pendingComplete?.task ?? null}
        kind={pendingComplete?.kind ?? null}
        onCancel={() => setPendingComplete(null)}
        onSkip={() => {
          if (pendingComplete) runComplete(pendingComplete.task.id, false)
          setPendingComplete(null)
        }}
        onCount={() => {
          if (pendingComplete) runComplete(pendingComplete.task.id, true)
          setPendingComplete(null)
        }}
      />

      {/* State-aware keyboard legend (desktop only) — the honest surface for
          the shortcuts. Numbers are omitted; they're just focus jumps. */}
      {(focusTask || topThree.length > 0) && (
        <div className="hidden justify-center px-6 pb-6 md:flex">
          <KeyHints
            items={
              focusTask
                ? [
                    ['d', 'Done'],
                    ['s', 'Snooze'],
                    ['e', 'Edit'],
                    ['p', 'Timer'],
                    ['Esc', 'Return'],
                    ['⌫', 'Delete'],
                  ]
                : [
                    ['↵', 'Start'],
                    ['s', 'Snooze'],
                    ['r', 'Snooze rest'],
                    ['d', 'Done'],
                    ['e', 'Edit'],
                    ['⌫', 'Delete'],
                    ['↑↓', 'Move'],
                  ]
            }
          />
        </div>
      )}
    </div>
  )
}

// The Focus View: the single Selected Task, full-bleed. Only rendered when a
// task is selected, so Return is always available.
function Hero({
  task,
  onReturn,
  onComplete,
  onSnooze,
  onSnoozeSubtasks,
  onToggleSubtask,
  onEdit,
  onDelete,
}: {
  task: Task
  onReturn: () => void
  onComplete: () => void
  onSnooze: () => void
  onSnoozeSubtasks: () => void
  onToggleSubtask: (index: number) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const nextSub =
    task.subtasks.length > 0
      ? findNextActionableSubtask(task.subtasks, new Date())
      : undefined
  const doneCount = task.subtasks.filter((s) => s.done).length
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )
  const titleText = nextSub?.title ?? task.title

  // Tick "now" every second while the timer is running so the Done
  // gate re-evaluates without the user having to do anything. When the
  // timer is paused we don't need the interval since the gate state
  // doesn't change.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!task.timerStartedAt) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [task.timerStartedAt])
  const gated = isCompletionGated(task, now)
  const remainingSec = gated
    ? Math.ceil(task.timeFrame * 60 - currentTimerSeconds(task, now))
    : 0
  const advance = willAdvanceSubtask(task, now)

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 pb-8 md:px-16 md:pb-16">
      <div className="mb-4 text-center font-mono text-[10px] tracking-[0.2em] text-zinc-500 uppercase md:mb-6 md:text-xs">
        Right now
      </div>

      <div
        aria-hidden="true"
        className="mb-4 text-[5rem] leading-none select-none md:mb-8 md:text-[7rem]"
      >
        {task.emoji}
      </div>

      <h1
        id="main-content"
        tabIndex={-1}
        className="dtn-task-title max-w-[20rem] text-center text-[2.6rem] leading-[1.05] text-zinc-50 md:max-w-3xl md:text-[5.5rem] md:leading-[1.02]"
        style={{
          letterSpacing: '-0.015em',
          textWrap: 'balance',
        }}
      >
        {titleText}
      </h1>

      {nextSub && (
        <div className="mt-3 font-mono text-xs text-zinc-400 md:mt-5 md:text-base">
          part of{' '}
          <span className="dtn-task-title" style={{ fontSize: '1.05rem' }}>
            {task.title}
          </span>{' '}
          <span className="text-zinc-600">·</span>{' '}
          <span className="text-zinc-50 tabular-nums">
            {doneCount}/{task.subtasks.length}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:mt-6 md:gap-3">
        {dueLabel && <Chip>{dueLabel}</Chip>}
        {task.timeFrame ? <Chip>{minutesToHours(task.timeFrame)}</Chip> : null}
        {repeatLabel && <Chip>↻ {repeatLabel}</Chip>}
      </div>

      <button
        type="button"
        onClick={onComplete}
        disabled={gated}
        title={
          gated
            ? `Run the timer to ${Math.ceil(task.timeFrame)} min — ${Math.ceil(
                remainingSec / 60,
              )} min to go`
            : undefined
        }
        className="mt-8 flex w-full max-w-[320px] items-center justify-center gap-3 rounded-full bg-white px-8 py-3.5 font-mono text-lg font-semibold text-black transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white md:mt-12 md:w-auto md:max-w-none md:gap-4 md:px-10 md:py-5 md:text-xl"
        style={{ boxShadow: '0 0 80px rgba(255, 255, 255, 0.1)' }}
      >
        <span>
          {gated
            ? `${Math.ceil(remainingSec / 60)} min to go`
            : advance
              ? 'Subtask Done'
              : 'Done'}
        </span>
        <Kbd variant="on-light">D</Kbd>
      </button>

      <div className="mt-3 grid w-full max-w-[320px] grid-cols-3 gap-2 md:mt-4 md:flex md:max-w-none md:w-auto md:items-center md:gap-3">
        <SecondaryAction k="Esc" label="Return" onClick={onReturn} />
        <SecondaryAction k="S" label="Snooze" onClick={onSnooze} />
        {task.subtasks.length > 0 && (
          <SecondaryAction
            k="⇧S"
            label="Snooze subtasks"
            onClick={onSnoozeSubtasks}
          />
        )}
        <SecondaryAction k="E" label="Edit" onClick={onEdit} />
        <SecondaryAction k="⌫" label="Delete" onClick={onDelete} />
      </div>

      <HeroTimer task={task} />

      {task.subtasks.length > 0 && (
        <div className="mt-8 w-full max-w-[420px]">
          <SubtaskList subtasks={task.subtasks} onToggle={onToggleSubtask} />
        </div>
      )}
    </div>
  )
}

function NowSkeleton() {
  // Mirror the Top Tasks rows (the no-selection entry state) so the layout
  // doesn't jump from a hero into a list once data arrives.
  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar />
      <div
        className="flex flex-1 flex-col items-center justify-center px-5 pb-20 md:px-16"
        role="status"
        aria-label="Loading your tasks"
      >
        <div className="w-full max-w-xl">
          <Skeleton className="mb-4 ml-1 h-3 w-20" />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3"
              >
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-5 w-2/5" />
                  <Skeleton className="mt-2 h-3 w-1/4" />
                </div>
                <Skeleton className="h-7 w-14 rounded-full" />
                <Skeleton className="h-7 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Pulls in the keeper task for 0-time-frame children so the widget
// always operates on the row that holds the timer state. For standalone
// tasks this just renders the widget against the task itself.
function HeroTimer({ task }: { task: Task }) {
  const keeperQuery = useTask(task.timekeeperId ?? '')
  const timerTask = task.timekeeperId ? keeperQuery.data : task
  if (!timerTask) return null
  return (
    <div className="mt-6 w-full max-w-[420px]">
      <TimerWidget
        task={timerTask}
        actionId={task.id}
        plannedMinutes={timerTask.timeFrame}
        compact
      />
    </div>
  )
}
