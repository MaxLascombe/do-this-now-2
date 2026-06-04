import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { useDeleteTask, useSnoozeTask, useTask } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { useConfirm } from '../components/ConfirmProvider'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TimerWidget } from '../components/TimerWidget'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { KeyAction } from '../hooks/useKeyAction'

const OVERDUE = '#fb7185'

export const Route = createFileRoute('/tasks/$id/')({
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
  const confirm = useConfirm()

  const snoozeAction = () => snoozeMutation.mutate({ id })
  const deleteAction = async () => {
    const ok = await confirm({
      message: `Are you sure you want to delete '${task?.title ?? 'this task'}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    deleteMutation.mutate(id, { onSuccess: () => router.history.back() })
  }

  const keyActions: Array<KeyAction> = [
    { key: 'escape', description: 'Back', action: () => router.history.back() },
    {
      key: 'e',
      description: 'Edit',
      action: () => router.navigate({ to: '/tasks/$id/edit', params: { id } }),
    },
    { key: 's', description: 'Snooze', action: snoozeAction },
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
        <div className="flex flex-1 items-center justify-center">
          {taskQuery.isPending ? (
            <Loading />
          ) : taskQuery.isError ? (
            <ErrorState
              message="Couldn't load this task."
              onRetry={() => taskQuery.refetch()}
            />
          ) : (
            <ErrorState message="Task not found." />
          )}
        </div>
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

        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {task.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 font-mono text-xs text-zinc-300"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {task.notes && (
          <div>
            <div className="mb-2 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              Notes
            </div>
            <p className="font-mono text-sm whitespace-pre-wrap text-zinc-300">
              {task.notes}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
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
        </div>

        {task.subtasks.length > 0 && (
          <div>
            <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              <span>Subtasks</span>
              <span className="tabular-nums">
                {doneCount}/{task.subtasks.length}
              </span>
            </div>
            <ul className="space-y-1">
              {task.subtasks.map((sub, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 font-mono text-sm"
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
                      (sub.done ? 'text-zinc-500 line-through' : 'text-zinc-100')
                    }
                  >
                    <span className="sr-only">
                      {sub.done ? 'Completed: ' : 'To do: '}
                    </span>
                    {sub.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          to="/tasks/$id/edit"
          params={{ id }}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-2.5 font-mono text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50 md:hidden"
        >
          Edit task
        </Link>
      </div>
    </div>
  )
}
