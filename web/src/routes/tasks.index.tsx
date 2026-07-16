import { startOfToday } from '@dtn/shared/day-index'
import { dueGroupLabel, tasksListEyebrow } from '@dtn/shared/format'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
import {
  useAllTasks,
  useCompleteTask,
  useCreateTask,
  useDeleteTask,
  usePrefetchTask,
  usePrimeTaskCache,
  useSnoozeTask,
  useTaskTimer,
  useTopTasks,
  useUnsnoozeTask,
} from '@dtn/shared/queries'
import { taskToInput } from '@dtn/shared/task-input'
import { isSnoozed, sortTasks } from '@dtn/shared/task-sorting'
import { willAdvanceSubtask } from '@dtn/shared/task-transitions'
import {
  completionConfirmKind,
  isCompletionGated,
} from '@dtn/shared/timer-utils'

import { createFileRoute, useNavigate } from '@tanstack/react-router'
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
import { TaskListSkeleton } from '../components/Skeleton'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { RowAction, RowMenu, TaskRow } from '../components/TaskRow'
import { useToast } from '../components/ToastProvider'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import { usePersistedState } from '../hooks/usePersistedState'
import { SHORTCUTS as S, bind } from '../lib/shortcuts'
import type { Task } from '@dtn/shared/types'
import type { KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/tasks/')({
  head: () => ({ meta: [{ title: 'Tasks · Do This Now' }] }),
  component: TasksList,
})

const OVERDUE = '#fb7185'

function TasksList() {
  const navigate = useNavigate()
  const [selectedTask, setSelectedTask] = useState(0)
  const [sort, setSort] = usePersistedState<'CHRON' | 'TOP'>(
    'dtn.tasks.sort',
    'CHRON',
  )
  const [query, setQuery] = useState('')
  const taskElems = useRef<Array<HTMLElement>>([])
  const searchRef = useRef<HTMLInputElement>(null)

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
    const q = query.trim().toLowerCase()
    return q
      ? arr.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.toLowerCase().includes(q)),
        )
      : arr
  }, [sort, data, dataTop, query])

  const indexOf = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach((t, i) => m.set(t.id, i))
    return (id: string) => m.get(id) ?? -1
  }, [tasks])

  // A new search resets the cursor to the top result.
  useEffect(() => setSelectedTask(0), [query])

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const unsnoozeMutation = useUnsnoozeTask()
  const timer = useTaskTimer()
  const toast = useToast()
  const createMutation = useCreateTask()
  const prefetchTask = usePrefetchTask()
  const primeTaskCache = usePrimeTaskCache()
  const confirm = useConfirm()

  const [quickTitle, setQuickTitle] = useState('')
  // Capture a task fast: a title plus sensible defaults (due today, 30 min).
  const quickAdd = () => {
    const title = quickTitle.trim()
    if (!title || createMutation.isPending) return
    createMutation.mutate({
      title,
      emoji: '📝',
      due: dateString(new Date()),
      dueTime: null,
      strictDeadline: false,
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

  const [pendingComplete, setPendingComplete] = useState<{
    task: Task
    kind: 'over' | 'under'
  } | null>(null)

  const runComplete = (id: string, countMeasurement: boolean) => {
    doneMutation.mutate({ id, countMeasurement })
  }

  // Per-task actions — the inline row buttons call these directly on their
  // own task; the keyboard shortcuts below call them on the cursored task.
  const completeFor = (t: Task | undefined) => {
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
  const completeAction = () => completeFor(tasks.at(selectedTask))

  const editFor = (t: Task | undefined) => {
    if (!t) return
    primeTaskCache(t)
    navigate({ to: '/tasks/$id/edit', params: { id: t.id } })
  }
  const editAction = () => editFor(tasks.at(selectedTask))

  // Selecting a task starts its timer (which makes it the Selected Task) and
  // drops into the Focus View on Home — the commit that replaces the old
  // "open the detail page".
  const selectFor = (t: Task | undefined) => {
    if (!t) return
    primeTaskCache(t)
    timer.mutate({ id: t.id, action: { kind: 'start' } })
    navigate({ to: '/' })
  }
  const selectAction = () => selectFor(tasks.at(selectedTask))

  const deleteFor = async (t: Task | undefined) => {
    if (!t) return
    const ok = await confirm({
      message: `Are you sure you want to delete '${t.title}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
    const restore = taskToInput(t)
    deleteMutation.mutate(t.id, {
      onSuccess: () =>
        toast({
          message: `Deleted '${t.title}'`,
          actionLabel: 'Undo',
          onAction: () => createMutation.mutate(restore),
        }),
    })
  }
  const deleteAction = () => deleteFor(tasks.at(selectedTask))

  // Rows here show un-opened tasks, so Snooze pushes the whole task out
  // rather than just its next subtask, which isn't visible on this page.
  // Subtask-level snoozing lives in the Focus View.
  const snoozeFor = (t: Task | undefined) => {
    if (!t) return
    const { id } = t
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
    )
  }
  const snoozeAction = () => snoozeFor(tasks.at(selectedTask))

  const wakeFor = (t: Task | undefined) => {
    if (!t) return
    unsnoozeMutation.mutate(t.id)
  }
  const wakeAction = () => wakeFor(tasks.at(selectedTask))

  // Inline buttons for a row — the same rectangle-with-buttons shape as Home.
  // Start and Snooze stay inline; a snoozed task offers Wake in place of
  // Snooze. Everything else lives behind the row's ⋯ menu.
  const rowActionsFor = (t: Task) => {
    const gated = isCompletionGated(t, new Date())
    return (
      <>
        <RowAction label="Start" onClick={() => selectFor(t)} />
        {isSnoozed(t) ? (
          <RowAction label="Wake" onClick={() => wakeFor(t)} />
        ) : (
          <RowAction label="Snooze" onClick={() => snoozeFor(t)} />
        )}
        <RowMenu
          items={[
            {
              label: 'Done',
              onClick: () => completeFor(t),
              disabled: gated,
              title: gated ? 'Run the timer to its target first' : undefined,
            },
            { label: 'Edit', onClick: () => editFor(t) },
            { label: 'Delete', onClick: () => deleteFor(t), danger: true },
          ]}
        />
      </>
    )
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
    bind(S.search, () => searchRef.current?.focus()),
    bind(S.done, completeAction),
    bind(S.now, () => navigate({ to: '/' })),
    bind(S.newTask, () => navigate({ to: '/new-task' })),
    bind(S.history, () => navigate({ to: '/history' })),
    bind(S.stats, () => navigate({ to: '/stats' })),
    bind(S.sort, () => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON'))),
    bind(S.edit, editAction),
    bind(S.select, selectAction),
    bind(S.snooze, snoozeAction),
    bind(S.wake, wakeAction),
    bind(S.moveUp, () => setSelectedTask((t) => Math.max(t - 1, 0))),
    bind(S.moveDown, () =>
      setSelectedTask((t) => Math.min(t + 1, tasks.length - 1)),
    ),
    // Number keys jump the focus ring straight to the nth row (undisplayed).
    ...Array.from({ length: 9 }, (_, n) => ({
      key: String(n + 1),
      description: `Focus task ${n + 1}`,
      action: () => {
        if (n < tasks.length) setSelectedTask(n)
      },
    })),
    bind(S.home, () => navigate({ to: '/' })),
    bind(S.delete, deleteAction),
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

  const eyebrow = useMemo(() => tasksListEyebrow(tasks), [tasks])

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

      <form
        onSubmit={(e) => {
          e.preventDefault()
          quickAdd()
        }}
        className="relative px-5 pb-3 md:px-10"
      >
        <span className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 font-mono text-sm text-zinc-500 md:left-14">
          ＋
        </span>
        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Add a task — press Enter"
          aria-label="Quick-add a task"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 py-2 pr-4 pl-9 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600 md:pl-10"
        />
      </form>

      <div className="relative px-5 pb-3 md:px-10">
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              if (query) setQuery('')
              else e.currentTarget.blur()
            }
          }}
          placeholder="Search title or #tag…"
          aria-label="Search tasks by title or tag"
          className="w-full rounded-full border border-zinc-800 bg-zinc-900/50 px-4 py-2 pr-9 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              searchRef.current?.focus()
            }}
            aria-label="Clear search"
            className="absolute top-1/2 right-8 -translate-y-1/2 px-1 font-mono text-sm text-zinc-500 hover:text-zinc-200 md:right-12"
          >
            ✕
          </button>
        ) : (
          <kbd className="absolute top-1/2 right-8 -translate-y-1/2 rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[10px] font-bold text-zinc-500 md:right-12">
            /
          </kbd>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-28 md:px-10 md:pb-24">
        {tasks.length === 0 && !isFetching && (
          <div className="mt-8 flex justify-center text-center font-mono text-sm text-zinc-500">
            {activeQuery.isError ? (
              <ErrorState
                message="Couldn't load your tasks."
                onRetry={() => activeQuery.refetch()}
              />
            ) : query ? (
              `No tasks match "${query.trim()}"`
            ) : (
              'No tasks'
            )}
          </div>
        )}

        {isFetching && tasks.length === 0 && !activeQuery.isError && (
          <TaskListSkeleton rows={6} />
        )}

        {sort === 'CHRON' ? (
          <div className="flex flex-col gap-6">
            {groupedChron.map(({ key, tasks: gTasks }) => {
              const g = dueGroupLabel(key)
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
                      return (
                        <div key={t.id} ref={setRef(t.id) as never}>
                          <TaskRow
                            task={t}
                            selected={i === selectedTask}
                            onClick={() => setSelectedTask(i)}
                            onMouseEnter={() => prefetchTask(t.id)}
                            actions={rowActionsFor(t)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.map((t, i) => (
              <Fragment key={t.id}>
                {i === firstTaskDueAfterToday && (
                  <Separator label="Due after today" />
                )}
                {i === firstSnoozedTask && <Separator label="Snoozed" />}
                <div ref={setRef(t.id) as never}>
                  <TaskRow
                    task={t}
                    selected={i === selectedTask}
                    onClick={() => setSelectedTask(i)}
                    onMouseEnter={() => prefetchTask(t.id)}
                    actions={rowActionsFor(t)}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        )}

        {isFetching && tasks.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Loading />
          </div>
        )}
      </div>

      <div className="fixed right-10 bottom-6 left-10 hidden md:block">
        <KeyHints
          items={[
            ['↵', 'select'],
            ['d', 'done'],
            ['s', 'snooze'],
            ['e', 'edit'],
            ['⌫', 'delete'],
            ['↑↓', 'move'],
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
    aria-pressed={active}
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
        o
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

