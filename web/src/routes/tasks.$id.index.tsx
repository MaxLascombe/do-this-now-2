import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { useTask } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TimerWidget } from '../components/TimerWidget'
import { TopBar } from '../components/TopBar'

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.history.back()
      if (e.key === 'e' || e.key === 'E')
        router.navigate({ to: '/tasks/$id/edit', params: { id } })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [router, id])

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
          <span className="text-5xl leading-none select-none md:text-6xl">
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
                  <span className={sub.done ? 'text-emerald-400' : 'text-zinc-600'}>
                    {sub.done ? '☑' : '☐'}
                  </span>
                  <span
                    className={
                      'min-w-0 flex-1 truncate ' +
                      (sub.done ? 'text-zinc-500 line-through' : 'text-zinc-100')
                    }
                  >
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
