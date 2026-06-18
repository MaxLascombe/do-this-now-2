import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { dateString, nextDueDate } from '@dtn/shared/helpers'
import {
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  useSnoozeTask,
  useTask,
  useTaskTimer,
  useUpdateTask,
} from '@dtn/shared/queries'
import { taskToInput } from '@dtn/shared/task-input'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import { minutesToHours } from '@dtn/shared/time'
import {
  completionConfirmKind,
  currentTimerSeconds,
  isCompletionGated,
} from '@dtn/shared/timer-utils'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { useConfirm } from '../components/ConfirmProvider'
import { CountConfirmModal } from '../components/CountConfirmModal'
import { ErrorState } from '../components/ErrorState'
import { LinkifiedNotes } from '../components/LinkifiedNotes'
import { Skeleton } from '../components/Skeleton'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TimerWidget } from '../components/TimerWidget'
import { useToast } from '../components/ToastProvider'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { Task } from '@dtn/shared/types'
import type { KeyAction } from '../hooks/useKeyAction'

const OVERDUE = '#fb7185'

export const Route = createFileRoute('/tasks/$id/')({
  head: () => ({ meta: [{ title: 'Task · Do This Now' }] }),
  component: TaskDetail,
})

function TaskDetail() {
  const { id } = Route.useParams()
  const router = useRouter()
  const taskQuery = useTask(id)
  const [sheetOpen, setSheetOpen] = useState(false)

  const task = taskQuery.data
  // 0-time-frame children track their timer on the keeper row, like the
  // edit page does — load it so the widget shows + mutates the right task.
  const keeperQuery = useTask(task?.timekeeperId ?? '')
  const timerTask = task?.timekeeperId ? keeperQuery.data : task

  const snoozeMutation = useSnoozeTask()
  const deleteMutation = useDeleteTask()
  const doneMutation = useCompleteTask()
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()
  const timer = useTaskTimer()
  const confirm = useConfirm()
  const toast = useToast()

  // The mutation targets the route id; the server maps a 0-frame child to
  // its keeper, while timerTask gives the correct running state to read.
  const toggleTimerAction = () =>
    timer.mutate({
      id,
      action: { kind: timerTask?.timerStartedAt ? 'pause' : 'start' },
    })

  const reschedule = (due: string) => {
    if (!task) return
    updateTask.mutate({ id, input: { ...taskToInput(task), due } })
  }

  // Clone the task's config as a fresh task and jump to it. Timer state,
  // completion history, and subtask `done` flags don't carry over —
  // taskToInput keeps only the user-authored fields.
  const duplicateAction = async () => {
    if (!task) return
    const copy = await createTask.mutateAsync({
      ...taskToInput(task),
      title: `${task.title} (copy)`,
      subtasks: task.subtasks.map((s) => ({
        ...s,
        done: false,
        snooze: undefined,
      })),
    })
    router.navigate({ to: '/tasks/$id', params: { id: copy.id } })
  }

  const toggleSubtask = (index: number) => {
    if (!task) return
    const subtasks = task.subtasks.map((s, i) =>
      i === index ? { ...s, done: !s.done } : s,
    )
    updateTask.mutate({ id, input: { ...taskToInput(task), subtasks } })
  }

  const [pendingComplete, setPendingComplete] = useState<{
    task: Task
    kind: 'over' | 'under'
  } | null>(null)

  // Tick "now" each second while the timer runs so the Done gate
  // re-evaluates on its own, matching the home view.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!task?.timerStartedAt) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [task?.timerStartedAt])

  const runComplete = (countMeasurement: boolean) =>
    doneMutation.mutate(
      { id, countMeasurement },
      { onSuccess: () => router.history.back() },
    )

  const completeAction = () => {
    if (!task) return
    if (isCompletionGated(task, now)) return
    if (willAdvanceSubtask(task, now)) {
      runComplete(true)
      return
    }
    const kind = completionConfirmKind(task, now)
    if (!kind) {
      runComplete(true)
      return
    }
    setPendingComplete({ task, kind })
  }

  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard blocked (e.g. insecure context) — nothing actionable
    }
  }

  const snoozeAction = () => snoozeMutation.mutate({ id })
  const deleteAction = async () => {
    if (!task) return
    const ok = await confirm({
      message: `Are you sure you want to delete '${task.title}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    // Snapshot the task's user-authored fields before deleting so Undo can
    // recreate it. The recreated task gets a new id; its content + subtasks
    // are restored faithfully.
    const restore = taskToInput(task)
    deleteMutation.mutate(id, {
      onSuccess: () => {
        router.history.back()
        toast({
          message: `Deleted '${task.title}'`,
          actionLabel: 'Undo',
          onAction: () => createTask.mutate(restore),
        })
      },
    })
  }

  const keyActions: Array<KeyAction> = [
    { key: 'escape', description: 'Back', action: () => router.history.back() },
    {
      key: 'e',
      description: 'Edit',
      action: () => router.navigate({ to: '/tasks/$id/edit', params: { id } }),
    },
    { key: 'd', description: 'Done', action: completeAction },
    { key: 's', description: 'Snooze', action: snoozeAction },
    {
      key: 'p',
      description: timerTask?.timerStartedAt ? 'Pause timer' : 'Start timer',
      action: toggleTimerAction,
    },
    { key: 'backspace', description: 'Delete', action: deleteAction },
    { key: 'n', description: 'Home', action: () => router.navigate({ to: '/' }) },
    {
      key: 't',
      description: 'Tasks',
      action: () => router.navigate({ to: '/tasks' }),
    },
    {
      key: 'h',
      description: 'History',
      action: () => router.navigate({ to: '/history' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => router.navigate({ to: '/stats' }),
    },
    {
      key: '=',
      description: 'New task',
      shift: true,
      action: () => router.navigate({ to: '/new-task' }),
    },
  ]
  useKeyAction(keyActions)

  if (taskQuery.isPending || !task) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <MobileChrome
          sheetOpen={sheetOpen}
          onOpenSheet={() => setSheetOpen(true)}
          onCloseSheet={() => setSheetOpen(false)}
        />
        {taskQuery.isPending ? (
          <div
            className="mx-auto w-full max-w-2xl space-y-6 px-5 pt-2 pb-12 md:px-10"
            role="status"
            aria-label="Loading task"
          >
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-40 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            {taskQuery.isError ? (
              <ErrorState
                message="Couldn't load this task."
                onRetry={() => taskQuery.refetch()}
              />
            ) : (
              <ErrorState message="Task not found." />
            )}
          </div>
        )}
      </div>
    )
  }

  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )
  const doneCount = task.subtasks.filter((s) => s.done).length

  const rescheduleOptions = [
    { label: 'Today', due: dateString(now) },
    {
      label: 'Tomorrow',
      due: dateString(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      ),
    },
    {
      label: '+1 week',
      due: dateString(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7),
      ),
    },
  ]

  const upcoming: Date[] = []
  {
    let cursor = task
    for (let i = 0; i < 3; i++) {
      const next = nextDueDate(cursor)
      if (!next) break
      upcoming.push(next)
      cursor = { ...cursor, due: dateString(next) }
    }
  }

  const gated = isCompletionGated(task, now)
  const remainingMin = gated
    ? Math.ceil(task.timeFrame - currentTimerSeconds(task, now) / 60)
    : 0
  const doneLabel = gated
    ? `${remainingMin} min to go`
    : willAdvanceSubtask(task, now)
      ? 'Subtask done'
      : 'Done'

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="flex items-end justify-between px-5 pt-2 pb-6 md:px-10">
        <div className="flex min-w-0 items-center gap-4">
          <span
            aria-hidden="true"
            className="text-5xl leading-none select-none md:text-6xl"
          >
            {task.emoji}
          </span>
          <PageHeading eyebrow="task">{task.title}</PageHeading>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Link
            to="/tasks/$id/edit"
            params={{ id }}
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <span>Edit</span>
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
              E
            </kbd>
          </Link>
          <button
            type="button"
            onClick={() => router.history.back()}
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <span>←</span>
            <span>Back</span>
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
              Esc
            </kbd>
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6 px-5 pb-12 md:px-10">
        {timerTask && (
          <TimerWidget
            task={timerTask}
            actionId={id}
            plannedMinutes={timerTask.timeFrame}
            compact
          />
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-sm text-zinc-400">
          {dueLabel && <span>{dueLabel}</span>}
          {task.timeFrame ? <span>{minutesToHours(task.timeFrame)}</span> : null}
          {repeatLabel && <span>↻ {repeatLabel}</span>}
          {task.strictDeadline && (
            <span style={{ color: OVERDUE }}>strict deadline</span>
          )}
        </div>

        {task.repeat === 'No Repeat' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              Reschedule
            </span>
            {rescheduleOptions.map((o) => (
              <button
                key={o.label}
                type="button"
                disabled={task.due === o.due || updateTask.isPending}
                onClick={() => reschedule(o.due)}
                className={
                  'rounded-full border px-3 py-1 font-mono text-xs ' +
                  (task.due === o.due
                    ? 'border-zinc-100 bg-zinc-50 text-zinc-950'
                    : 'border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-50')
                }
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {upcoming.length > 0 && (
          <div className="font-mono text-xs text-zinc-500">
            <span className="tracking-[0.2em] text-zinc-600 uppercase">
              Next
            </span>{' '}
            {upcoming
              .map((d) =>
                d.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }),
              )
              .join('  ·  ')}
          </div>
        )}

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((t) => (
              <Link
                key={t}
                to="/tags"
                search={{ tag: t }}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-50"
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {task.notes && (
          <div>
            <div className="mb-2 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              Notes
            </div>
            <LinkifiedNotes
              text={task.notes}
              className="font-mono text-sm whitespace-pre-wrap text-zinc-300"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          <button
            type="button"
            onClick={completeAction}
            disabled={gated}
            title={gated ? `Run the timer — ${remainingMin} min to go` : undefined}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-1.5 font-semibold text-black hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
          >
            <span>{doneLabel}</span>
            <kbd className="rounded border border-zinc-300 bg-black/10 px-1 py-0.5 text-[10px] font-bold text-zinc-900">
              D
            </kbd>
          </button>
          <button
            type="button"
            onClick={snoozeAction}
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <span>Snooze</span>
            <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
              S
            </kbd>
          </button>
          <button
            type="button"
            onClick={deleteAction}
            className="flex items-center gap-2 rounded-full border px-4 py-1.5 hover:bg-zinc-900"
            style={{ borderColor: 'rgba(251,113,133,0.3)', color: OVERDUE }}
          >
            <span>Delete</span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-400">
              ⌫
            </kbd>
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button
            type="button"
            onClick={duplicateAction}
            disabled={createTask.isPending}
            className="flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50 disabled:opacity-40"
          >
            {createTask.isPending ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
            <span>Subtasks</span>
            {task.subtasks.length > 0 && (
              <span className="tabular-nums">
                {doneCount}/{task.subtasks.length}
              </span>
            )}
          </div>
          {task.subtasks.length > 0 && (
            <ul className="space-y-1">
              {task.subtasks.map((sub, i) => (
                <li key={i} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleSubtask(i)}
                    aria-pressed={sub.done}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-left font-mono text-sm hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <span
                      aria-hidden="true"
                      className={sub.done ? 'text-emerald-400' : 'text-zinc-600'}
                    >
                      {sub.done ? '☑' : '☐'}
                    </span>
                    <span
                      className={
                        'min-w-0 flex-1 truncate ' +
                        (sub.done
                          ? 'text-zinc-500 line-through'
                          : 'text-zinc-100')
                      }
                    >
                      <span className="sr-only">
                        {sub.done ? 'Completed: ' : 'To do: '}
                      </span>
                      {sub.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link
          to="/tasks/$id/edit"
          params={{ id }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-2.5 font-mono text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50 md:hidden"
        >
          Edit task
        </Link>
      </div>

      <CountConfirmModal
        open={!!pendingComplete}
        task={pendingComplete?.task ?? null}
        kind={pendingComplete?.kind ?? null}
        onCancel={() => setPendingComplete(null)}
        onSkip={() => {
          if (pendingComplete) runComplete(false)
          setPendingComplete(null)
        }}
        onCount={() => {
          if (pendingComplete) runComplete(true)
          setPendingComplete(null)
        }}
      />
    </div>
  )
}
