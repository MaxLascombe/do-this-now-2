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
import { Loading } from '../components/Loading'
import { LinkifiedNotes } from '../components/LinkifiedNotes'
import { MobileChrome } from '../components/MobileChrome'
import { Skeleton } from '../components/Skeleton'
import { TaskRow } from '../components/TaskRow'
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

  const [selectedTaskIndex, setSelectedTaskIndex] = useState<0 | 1 | 2>(0)
  const localSelectedTask =
    tasks.length > selectedTaskIndex ? tasks.at(selectedTaskIndex) : tasks.at(0)
  const selectedTask = focusTask ?? localSelectedTask

  if (!focusTask && tasks.length > 0 && tasks.length <= selectedTaskIndex)
    setSelectedTaskIndex(tasks.length === 2 ? 1 : 0)

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const createTask = useCreateTask()
  const snoozeMutation = useSnoozeTask()
  const snoozeManyMutation = useSnoozeManyTasks()
  const unsnoozeMutation = useUnsnoozeTask()
  const prefetchTask = usePrefetchTask()
  const primeTaskCache = usePrimeTaskCache()
  const confirm = useConfirm()
  const toast = useToast()

  const [pendingComplete, setPendingComplete] = useState<{
    task: Task
    kind: 'over' | 'under'
  } | null>(null)

  const runComplete = (id: string, countMeasurement: boolean) => {
    doneMutation.mutate({ id, countMeasurement })
  }

  const completeTaskAction = () => {
    if (!selectedTask) return
    const now = new Date()
    if (isCompletionGated(selectedTask, now)) return
    // Subtask advance never triggers the count/skip confirm — that
    // dialog is about how to record the *whole task's* timer, which
    // doesn't fire on subtask completion.
    if (willAdvanceSubtask(selectedTask, now)) {
      runComplete(selectedTask.id, true)
      return
    }
    const kind = completionConfirmKind(selectedTask, now)
    if (!kind) {
      runComplete(selectedTask.id, true)
      return
    }
    setPendingComplete({ task: selectedTask, kind })
  }

  const snoozeTaskAction = () => {
    if (!selectedTask) return
    const { id } = selectedTask
    snoozeMutation.mutate(
      { id },
      {
        onSuccess: () =>
          toast({
            message: 'Task snoozed',
            actionLabel: 'Undo',
            onAction: () => unsnoozeMutation.mutate(id),
          }),
      },
    )
  }

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

  // Every task ranked below the current one — "clear my plate, leave just
  // this". Snoozes them an hour out so the Now view drops to the current task.
  const restIds = tasks.slice(selectedTaskIndex + 1).map((t) => t.id)
  const snoozeRestAction = () => {
    if (restIds.length === 0) return
    snoozeManyMutation.mutate(restIds)
  }

  const deleteTaskAction = async () => {
    if (!selectedTask) return
    const ok = await confirm({
      message: `Are you sure you want to delete '${selectedTask.title}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const title = selectedTask.title
    const restore = taskToInput(selectedTask)
    deleteMutation.mutate(selectedTask.id, {
      onSuccess: () =>
        toast({
          message: `Deleted '${title}'`,
          actionLabel: 'Undo',
          onAction: () => createTask.mutate(restore),
        }),
    })
  }

  const goEdit = () => {
    if (!selectedTask) return
    primeTaskCache(selectedTask)
    navigate({ to: '/tasks/$id/edit', params: { id: selectedTask.id } })
  }

  const goOpen = () => {
    if (!selectedTask) return
    primeTaskCache(selectedTask)
    navigate({ to: '/tasks/$id', params: { id: selectedTask.id } })
  }

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

  // Return: step off the Selected Task (pauses its timer, clears the pointer).
  const returnAction = () => {
    if (!focusTask) return
    unselectMutation.mutate()
  }

  const keyActions: Array<KeyAction> = [
    { key: 'd', description: 'Task done', action: completeTaskAction },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => navigate({ to: '/stats' }),
    },
    {
      key: '=',
      description: 'New task',
      shift: true,
      action: () => navigate({ to: '/new-task' }),
    },
    {
      key: 's',
      description: 'Snooze task',
      action: snoozeTaskAction,
      shift: false,
    },
    {
      key: 'S',
      description: 'Snooze all subtasks',
      action: snoozeAllSubtasksAction,
      shift: true,
    },
    {
      key: 'r',
      description: 'Snooze the rest',
      action: snoozeRestAction,
    },
    {
      key: 't',
      description: 'Tasks',
      action: () => navigate({ to: '/tasks' }),
    },
    { key: 'e', description: 'Edit task', action: goEdit },
    { key: 'enter', description: 'Open task', action: goOpen },
    {
      key: 'p',
      description: timerTask?.timerStartedAt ? 'Pause timer' : 'Start timer',
      action: toggleTimerAction,
    },
    {
      key: '1',
      description: 'Select first task',
      action: () => setSelectedTaskIndex(0),
    },
    {
      key: '2',
      description: 'Select second task',
      action: () => setSelectedTaskIndex(1),
    },
    {
      key: '3',
      description: 'Select third task',
      action: () => setSelectedTaskIndex(2),
    },
    {
      key: 'up',
      description: 'Select previous task',
      action: () => setSelectedTaskIndex((idx) => (idx === 2 ? 1 : 0)),
    },
    {
      key: 'down',
      description: 'Select next task',
      action: () => setSelectedTaskIndex((idx) => (idx === 0 ? 1 : 2)),
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

  const upNextTasks = tasks
    .slice(0, 3)
    .map((t, i) => ({ task: t, slot: (i + 1) as 1 | 2 | 3 }))
    .filter(({ slot }) => slot - 1 !== selectedTaskIndex)

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
          focus
          onReturn={returnAction}
          onComplete={completeTaskAction}
          onOpen={goOpen}
          onSnooze={snoozeTaskAction}
          onSnoozeSubtasks={snoozeAllSubtasksAction}
          restCount={0}
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
        selectedTask && (
          <Hero
            task={selectedTask}
            index={selectedTaskIndex}
            onComplete={completeTaskAction}
            onOpen={goOpen}
            onSnooze={snoozeTaskAction}
            onSnoozeSubtasks={snoozeAllSubtasksAction}
            onSnoozeRest={restIds.length > 0 ? snoozeRestAction : undefined}
            restCount={restIds.length}
            onEdit={goEdit}
            onDelete={deleteTaskAction}
          />
        )
      )}

      {/* Up-next stack — same TaskRow component used on /tasks, just with
          a slot kbd on desktop. In-flow below the hero on every breakpoint
          so it scrolls with the page rather than pinning to the viewport. */}
      {!focusTask && tasks.length > 1 && (
        <>
          <div className="hidden justify-center px-10 pb-10 md:flex">
            <div className="flex w-full max-w-xl flex-col gap-1.5">
              <div className="mb-2 px-1 font-mono text-[10px] tracking-[0.25em] text-zinc-600 uppercase">
                up next
              </div>
              {upNextTasks.map(({ task: t, slot }) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  kbd={String(slot)}
                  onClick={() => {
                    primeTaskCache(t)
                    setSelectedTaskIndex((slot - 1) as 0 | 1 | 2)
                  }}
                  onMouseEnter={() => prefetchTask(t.id)}
                />
              ))}
            </div>
          </div>
          <div className="px-5 pb-24 md:hidden">
            <div className="mb-2 px-1 font-mono text-[10px] tracking-[0.25em] text-zinc-600 uppercase">
              up next
            </div>
            <div className="flex flex-col gap-1.5">
              {upNextTasks.map(({ task: t, slot }) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onClick={() => {
                    primeTaskCache(t)
                    setSelectedTaskIndex((slot - 1) as 0 | 1 | 2)
                  }}
                />
              ))}
            </div>
          </div>
        </>
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
    </div>
  )
}

function Hero({
  task,
  index,
  focus = false,
  onReturn,
  onComplete,
  onOpen,
  onSnooze,
  onSnoozeSubtasks,
  onSnoozeRest,
  restCount,
  onEdit,
  onDelete,
}: {
  task: Task
  index?: 0 | 1 | 2
  focus?: boolean
  onReturn?: () => void
  onComplete: () => void
  onOpen: () => void
  onSnooze: () => void
  onSnoozeSubtasks: () => void
  onSnoozeRest?: () => void
  restCount: number
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
        {focus ? 'Right now' : `Task ${(index ?? 0) + 1} of 3 · Right now`}
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

      {task.notes && (
        <LinkifiedNotes
          text={task.notes}
          className="mt-5 max-w-md text-center font-mono text-xs whitespace-pre-wrap text-zinc-500 md:text-sm"
        />
      )}

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
        {onReturn && (
          <SecondaryAction k="Esc" label="Return" onClick={onReturn} />
        )}
        <SecondaryAction k="↵" label="Open" onClick={onOpen} />
        <SecondaryAction k="S" label="Snooze" onClick={onSnooze} />
        {task.subtasks.length > 0 && (
          <SecondaryAction
            k="⇧S"
            label="Snooze subtasks"
            onClick={onSnoozeSubtasks}
          />
        )}
        {onSnoozeRest && (
          <SecondaryAction
            k="R"
            label={`Snooze ${restCount} after`}
            onClick={onSnoozeRest}
          />
        )}
        <SecondaryAction k="E" label="Edit" onClick={onEdit} />
        <SecondaryAction k="⌫" label="Delete" onClick={onDelete} />
      </div>

      <HeroTimer task={task} />
    </div>
  )
}

function NowSkeleton() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar />
      <div
        className="flex flex-1 flex-col items-center justify-center px-5 pb-8 md:px-16"
        role="status"
        aria-label="Loading your tasks"
      >
        <Skeleton className="mb-4 h-20 w-20 rounded-2xl md:mb-8 md:h-28 md:w-28" />
        <Skeleton className="h-9 w-64 md:h-14 md:w-[28rem]" />
        <Skeleton className="mt-4 h-4 w-44" />
        <Skeleton className="mt-8 h-12 w-full max-w-[320px] rounded-full md:mt-12" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-24 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
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
