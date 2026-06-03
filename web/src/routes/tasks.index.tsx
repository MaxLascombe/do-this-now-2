import { newSafeDate } from '@dtn/shared/helpers'
import {
  useAllTasks,
  useCompleteTask,
  useDeleteTask,
  usePrefetchTask,
  usePrimeTaskCache,
  useSnoozeTask,
  useTask,
  useTopTasks,
} from '@dtn/shared/queries'
import { sortTasks } from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  completionConfirmKind,
  isCompletionGated,
} from '@dtn/shared/timer-utils'

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { useConfirm } from '../components/ConfirmProvider'
import { CountConfirmModal } from '../components/CountConfirmModal'
import { ErrorState } from '../components/ErrorState'
import { KeyHints } from '../components/KeyHints'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TaskRow } from '../components/TaskRow'
import { TimerWidget } from '../components/TimerWidget'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { Task } from '@dtn/shared/types'
import type { KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/tasks/')({
  head: () => ({ meta: [{ title: 'Tasks · Do This Now' }] }),
  component: TasksList,
})

const OVERDUE = '#fb7185'

const startOfToday = () => {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

const dayIndex = (d: Date) => {
  const today = startOfToday()
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      today.getTime()) /
      (24 * 60 * 60 * 1000),
  )
}

type GroupLabel = {
  label: string
  eyebrow: string
  overdueSuffix: string | null
}

const groupLabel = (firstTaskDue: string): GroupLabel => {
  const d = newSafeDate(firstTaskDue)
  const idx = dayIndex(d)
  if (idx < 0) {
    const days = Math.abs(idx)
    return {
      // Treat overdue days like any other dated group — label is the
      // weekday, rose accent stays *only* on the trailing days-overdue
      // tag so a long list of overdues doesn't drown the page in red.
      label: format(d, 'EEEE'),
      eyebrow: format(d, 'LLL d'),
      overdueSuffix: `${days} day${days === 1 ? '' : 's'} overdue`,
    }
  }
  if (idx === 0)
    return {
      label: 'Today',
      eyebrow: format(d, 'EEEE, LLL d'),
      overdueSuffix: null,
    }
  if (idx === 1)
    return {
      label: 'Tomorrow',
      eyebrow: format(d, 'EEEE, LLL d'),
      overdueSuffix: null,
    }
  return {
    label: format(d, 'EEEE'),
    eyebrow: format(d, 'LLL d'),
    overdueSuffix: null,
  }
}

function TasksList() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(0)
  const [sort, setSort] = useState<'CHRON' | 'TOP'>('CHRON')
  const taskElems = useRef<Array<HTMLElement>>([])

  const allTasks = useAllTasks({ enabled: sort === 'CHRON' })
  const topTasks = useTopTasks({ enabled: sort === 'TOP' })

  const data = allTasks.data ?? []
  const dataTop = topTasks.data ?? []

  const tasks = useMemo(() => {
    const arr = sort === 'CHRON' ? [...data] : [...dataTop]
    if (sort === 'CHRON') {
      arr.sort(
        (a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
      )
    } else {
      sortTasks(arr, startOfToday())
    }
    return arr
  }, [sort, data, dataTop])

  const indexOf = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach((t, i) => m.set(t.id, i))
    return (id: string) => m.get(id) ?? -1
  }, [tasks])

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const prefetchTask = usePrefetchTask()
  const primeTaskCache = usePrimeTaskCache()
  const confirm = useConfirm()

  const [pendingComplete, setPendingComplete] = useState<{
    task: Task
    kind: 'over' | 'under'
  } | null>(null)

  const runComplete = (id: string, countMeasurement: boolean) => {
    doneMutation.mutate({ id, countMeasurement })
  }

  const completeAction = () => {
    const t = tasks.at(selectedTask)
    if (!t) return
    const now = new Date()
    if (isCompletionGated(t, now)) return
    if (willAdvanceSubtask(t, now)) {
      runComplete(t.id, true)
      return
    }
    const kind = completionConfirmKind(t, now)
    if (!kind) {
      runComplete(t.id, true)
      return
    }
    setPendingComplete({ task: t, kind })
  }

  const editAction = () => {
    const t = tasks.at(selectedTask)
    if (!t) return
    primeTaskCache(t)
    navigate({ to: '/tasks/$id/edit', params: { id: t.id } })
  }

  const deleteAction = async () => {
    const t = tasks.at(selectedTask)
    if (!t) return
    const ok = await confirm({
      message: `Are you sure you want to delete '${t.title}'?`,
      confirmLabel: 'Delete',
    })
    if (ok) deleteMutation.mutate(t.id)
  }

  const snoozeSubtasks = () => {
    const t = tasks.at(selectedTask)
    if (!t) return
    snoozeMutation.mutate({ id: t.id, allSubtasks: true })
  }

  // Only scroll when the selected row leaves the viewport. The top-bar is
  // ~70px and the bottom KeyHints strip ~50px — we add a little extra padding
  // on each side so a row never feels glued to an edge before triggering.
  useEffect(() => {
    const el = taskElems.current.at(selectedTask)
    if (!el) return
    const rect = el.getBoundingClientRect()
    const TOP_PAD = 120
    const BOTTOM_PAD = 140
    if (rect.top < TOP_PAD) {
      window.scrollTo({
        behavior: 'smooth',
        top: rect.top + window.scrollY - TOP_PAD,
      })
    } else if (rect.bottom > window.innerHeight - BOTTOM_PAD) {
      window.scrollTo({
        behavior: 'smooth',
        top: rect.bottom + window.scrollY - (window.innerHeight - BOTTOM_PAD),
      })
    }
  }, [selectedTask])

  const keyActions: Array<KeyAction> = [
    { key: 'd', description: 'Mark task as done', action: completeAction },
    {
      key: 'n',
      description: 'Home',
      action: () => navigate({ to: '/' }),
    },
    {
      key: '=',
      description: 'New task',
      shift: true,
      action: () => navigate({ to: '/new-task' }),
    },
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
      key: 'o',
      description: 'Toggle order between date and top',
      action: () => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON')),
    },
    { key: 'e', description: 'Edit task', action: editAction },
    {
      key: 'S',
      description: 'Snooze all subtasks',
      action: snoozeSubtasks,
      shift: true,
    },
    {
      key: 'up',
      description: 'Select previous task',
      action: () => setSelectedTask((t) => Math.max(t - 1, 0)),
    },
    {
      key: 'down',
      description: 'Select next task',
      action: () => setSelectedTask((t) => Math.min(t + 1, tasks.length - 1)),
    },
    { key: 'Escape', description: 'Home', action: () => navigate({ to: '/' }) },
    {
      key: 'Backspace',
      description: 'Delete current task',
      action: deleteAction,
    },
  ]
  useKeyAction(keyActions)

  const groupedChron = useMemo(() => {
    if (sort !== 'CHRON') return []
    const groups: Array<{ key: string; tasks: Array<Task> }> = []
    for (const t of tasks) {
      const key = t.due
      const existing = groups.at(-1)
      if (existing && existing.key === key) existing.tasks.push(t)
      else groups.push({ key, tasks: [t] })
    }
    return groups
  }, [sort, tasks])

  const firstTaskDueAfterToday = useMemo(
    () =>
      sort === 'TOP'
        ? tasks.findIndex((task) => newSafeDate(task.due) > new Date())
        : -1,
    [sort, tasks],
  )
  const firstSnoozedTask = useMemo(
    () =>
      sort === 'TOP'
        ? tasks.findIndex(
            (task) => task.snooze && new Date(task.snooze) > new Date(),
          )
        : -1,
    [sort, tasks],
  )

  const eyebrow = useMemo(() => {
    const total = tasks.length
    const weekStart = startOfToday()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const thisWeek = tasks.filter((t) => {
      const d = newSafeDate(t.due)
      return d >= weekStart && d < weekEnd
    }).length
    return `${total} active · ${thisWeek} this week`
  }, [tasks])

  const setRef = useCallback(
    (id: string) => (e: HTMLButtonElement | null) => {
      const i = indexOf(id)
      if (e && i >= 0) taskElems.current[i] = e
    },
    [indexOf],
  )

  const isFetching =
    (sort === 'CHRON' && allTasks.isFetching) ||
    (sort === 'TOP' && topTasks.isFetching)
  const activeQuery = sort === 'CHRON' ? allTasks : topTasks

  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="flex flex-col items-stretch gap-3 px-5 pt-2 pb-4 md:flex-row md:items-end md:justify-between md:gap-0 md:px-10">
        <PageHeading eyebrow={eyebrow}>All tasks</PageHeading>
        <SortToggle
          sort={sort}
          onToggle={() => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON'))}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28 md:px-10 md:pb-24">
        {tasks.length === 0 && !isFetching && (
          <div className="mt-8 flex justify-center text-center font-mono text-sm text-zinc-500">
            {activeQuery.isError ? (
              <ErrorState
                message="Couldn't load your tasks."
                onRetry={() => activeQuery.refetch()}
              />
            ) : (
              'No tasks'
            )}
          </div>
        )}

        {sort === 'CHRON' ? (
          <div className="flex flex-col gap-6">
            {groupedChron.map(({ key, tasks: gTasks }) => {
              const g = groupLabel(key)
              return (
                <div key={key}>
                  <div className="mb-2 flex items-baseline gap-3">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-zinc-400 uppercase">
                      {g.eyebrow}
                      {g.overdueSuffix && (
                        <>
                          {' · '}
                          <span style={{ color: OVERDUE }}>
                            {g.overdueSuffix}
                          </span>
                        </>
                      )}
                    </span>
                    <span
                      className="dtn-heading text-zinc-100 uppercase"
                      style={{ fontSize: '0.95rem', letterSpacing: '0.15em' }}
                    >
                      {g.label}
                    </span>
                    <span className="mb-1 h-px flex-1 bg-zinc-900" />
                    <span className="font-mono text-xs text-zinc-600 tabular-nums">
                      {gTasks.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {gTasks.map((t) => {
                      const i = indexOf(t.id)
                      const isSelected = i === selectedTask
                      return (
                        <Fragment key={t.id}>
                          <div ref={setRef(t.id) as never}>
                            <TaskRow
                              task={t}
                              selected={isSelected}
                              onClick={() => {
                                primeTaskCache(t)
                                setSelectedTask(i)
                              }}
                              onMouseEnter={() => prefetchTask(t.id)}
                            />
                          </div>
                          {isSelected && (
                            <>
                              <SelectedActions
                                hasSubtasks={t.subtasks.length > 0}
                                advance={willAdvanceSubtask(t, new Date())}
                                onComplete={completeAction}
                                onEdit={editAction}
                                onSnoozeSubtasks={snoozeSubtasks}
                                onDelete={deleteAction}
                              />
                              <SelectedTimer task={t} />
                            </>
                          )}
                        </Fragment>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.map((t, i) => {
              const isSelected = i === selectedTask
              return (
                <Fragment key={t.id}>
                  {i === firstTaskDueAfterToday && (
                    <Separator label="Due after today" />
                  )}
                  {i === firstSnoozedTask && <Separator label="Snoozed" />}
                  <div ref={setRef(t.id) as never}>
                    <TaskRow
                      task={t}
                      selected={isSelected}
                      onClick={() => {
                        primeTaskCache(t)
                        setSelectedTask(i)
                      }}
                      onMouseEnter={() => prefetchTask(t.id)}
                    />
                  </div>
                  {isSelected && (
                    <>
                      <SelectedActions
                        hasSubtasks={t.subtasks.length > 0}
                        advance={willAdvanceSubtask(t, new Date())}
                        onComplete={completeAction}
                        onEdit={editAction}
                        onSnoozeSubtasks={snoozeSubtasks}
                        onDelete={deleteAction}
                      />
                      <SelectedTimer task={t} />
                    </>
                  )}
                </Fragment>
              )
            })}
          </div>
        )}

        {isFetching && (
          <div className="mt-4 flex justify-center">
            <Loading />
          </div>
        )}
      </div>

      <div className="fixed right-10 bottom-6 left-10 hidden md:block">
        <KeyHints
          items={[
            ['D', 'done'],
            ['E', 'edit'],
            ['⌫', 'delete'],
            ['↑↓', 'select'],
            ['O', 'toggle sort'],
            ['+', 'new'],
            ['Esc', 'home'],
          ]}
        />
      </div>

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

const SortToggle = ({
  sort,
  onToggle,
}: {
  sort: 'CHRON' | 'TOP'
  onToggle: () => void
}) => (
  <div className="flex w-full items-center rounded-full border border-zinc-800 bg-zinc-900/60 p-1 font-mono text-sm md:inline-flex md:w-auto">
    <SortPill label="By date" active={sort === 'CHRON'} onClick={onToggle} />
    <SortPill label="By priority" active={sort === 'TOP'} onClick={onToggle} />
  </div>
)

const SortPill = ({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-1.5 transition-colors md:flex-none ' +
      (active
        ? 'bg-zinc-50 text-zinc-900'
        : 'text-zinc-400 hover:text-zinc-100')
    }
  >
    <span>{label}</span>
    {!active && (
      <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
        O
      </kbd>
    )}
  </button>
)

const Separator = ({ label }: { label: string }) => (
  <div className="mt-3 mb-1 flex items-baseline gap-3">
    <span
      className="dtn-heading text-zinc-100 uppercase"
      style={{ fontSize: '0.95rem', letterSpacing: '0.15em' }}
    >
      {label}
    </span>
    <span className="mb-1 h-px flex-1 bg-zinc-900" />
  </div>
)

const SelectedActions = ({
  hasSubtasks,
  advance,
  onComplete,
  onEdit,
  onSnoozeSubtasks,
  onDelete,
}: {
  hasSubtasks: boolean
  advance: boolean
  onComplete: () => void
  onEdit: () => void
  onSnoozeSubtasks: () => void
  onDelete: () => void
}) => (
  <div className="mb-2 ml-12 flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={onComplete}
      className="flex items-center gap-2 rounded-full bg-zinc-50 px-4 py-2 font-mono text-sm font-semibold text-zinc-900 hover:bg-zinc-100"
    >
      <span>{advance ? 'Subtask Done' : 'Complete'}</span>
      <kbd className="rounded bg-black/15 px-1.5 py-0.5 text-[10px] font-bold">
        D
      </kbd>
    </button>
    <ActionGhost k="E" label="Edit" onClick={onEdit} />
    {hasSubtasks && (
      <ActionGhost k="⇧S" label="Snooze subtasks" onClick={onSnoozeSubtasks} />
    )}
    <ActionGhost k="⌫" label="Delete" onClick={onDelete} />
  </div>
)

// Compact timer slot under each selected row. Resolves child→keeper
// internally so children share their keeper's timer.
const SelectedTimer = ({ task }: { task: Task }) => {
  const keeperQuery = useTask(task.timekeeperId ?? '')
  const timerTask = task.timekeeperId ? keeperQuery.data : task
  if (!timerTask) return null
  return (
    <div className="mb-3 ml-12">
      <TimerWidget
        task={timerTask}
        actionId={task.id}
        plannedMinutes={timerTask.timeFrame}
        compact
      />
    </div>
  )
}

const ActionGhost = ({
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
    className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-2 font-mono text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
  >
    <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
      {k}
    </kbd>
    <span>{label}</span>
  </button>
)
