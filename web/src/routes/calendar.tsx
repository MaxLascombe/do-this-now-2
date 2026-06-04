import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import type { Task } from '@dtn/shared/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TaskRow } from '../components/TaskRow'
import { TopBar } from '../components/TopBar'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/calendar')({
  head: () => ({ meta: [{ title: 'Calendar · Do This Now' }] }),
  component: Calendar,
})

const ACCENT = '#34d399'
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const addMonths = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth() + n, 1)

function Calendar() {
  const navigate = useNavigate()
  const { data, isLoading } = useAllTasks()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [sheetOpen, setSheetOpen] = useState(false)
  const todayKey = dateString(new Date())
  const [selectedKey, setSelectedKey] = useState(todayKey)

  const keyActions: KeyAction[] = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 'n', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 't', description: 'Tasks', action: () => navigate({ to: '/tasks' }) },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    { key: 'a', description: 'Stats', action: () => navigate({ to: '/stats' }) },
  ]
  useKeyAction(keyActions)

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of data ?? []) {
      const key = dateString(newSafeDate(t.due))
      const list = map.get(key)
      if (list) list.push(t)
      else map.set(key, [t])
    }
    return map
  }, [data])

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const leading = startOfMonth(cursor).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = cursor.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
  const selectedTasks = byDay.get(selectedKey) ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="what's due when">Calendar</PageHeading>
      </div>

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-24">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="flex items-center justify-between font-mono">
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, -1))}
              aria-label="Previous month"
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
            >
              ←
            </button>
            <div className="text-sm font-semibold text-zinc-100">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => setCursor((c) => addMonths(c, 1))}
              aria-label="Next month"
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
            >
              →
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loading />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="pb-1 text-center font-mono text-[10px] tracking-widest text-zinc-600 uppercase"
                >
                  {w}
                </div>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />
                const key = dateString(new Date(year, month, day))
                const tasks = byDay.get(key) ?? []
                const isToday = key === todayKey
                const isSelected = key === selectedKey
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedKey(key)}
                    aria-label={`${monthLabel} ${day}, ${tasks.length} tasks`}
                    aria-pressed={isSelected}
                    className={
                      'flex aspect-square flex-col items-center justify-start gap-1 rounded-xl border p-1.5 font-mono transition-colors ' +
                      (isSelected
                        ? 'border-zinc-600 bg-zinc-900'
                        : 'border-zinc-800/60 hover:bg-zinc-900/60')
                    }
                  >
                    <span
                      className={
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums ' +
                        (isToday
                          ? 'font-bold text-zinc-950'
                          : 'text-zinc-400')
                      }
                      style={isToday ? { background: ACCENT } : undefined}
                    >
                      {day}
                    </span>
                    <span className="flex min-h-0 flex-wrap justify-center gap-0.5 overflow-hidden text-[11px] leading-none">
                      {tasks.slice(0, 3).map((t) => (
                        <span key={t.id} aria-hidden="true">
                          {t.emoji}
                        </span>
                      ))}
                      {tasks.length > 3 && (
                        <span className="text-[9px] text-zinc-500">
                          +{tasks.length - 3}
                        </span>
                      )}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <div>
            <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              <span>{selectedKey === todayKey ? 'Today' : selectedKey}</span>
              <button
                type="button"
                onClick={() =>
                  navigate({ to: '/new-task', search: { due: selectedKey } })
                }
                className="rounded-full border border-zinc-800 px-3 py-1 tracking-normal text-zinc-400 normal-case hover:bg-zinc-900 hover:text-zinc-50"
              >
                + New task
              </button>
            </div>
            {selectedTasks.length === 0 ? (
              <p className="font-mono text-sm text-zinc-600">
                Nothing due this day.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {selectedTasks.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onClick={() =>
                      navigate({ to: '/tasks/$id', params: { id: t.id } })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
