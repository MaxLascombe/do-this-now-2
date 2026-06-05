import { formatDaysAgo } from '@dtn/shared/format'
import { dateString } from '@dtn/shared/helpers'
import { useHistory, useStats } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { useMemo, useState } from 'react'

import { KeyHints } from '../components/KeyHints'
import { ErrorState } from '../components/ErrorState'
import { TaskListSkeleton } from '../components/Skeleton'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { HistoryEntry } from '@dtn/shared/types'
import type { KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/history')({
  head: () => ({ meta: [{ title: 'History · Do This Now' }] }),
  component: History,
})

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'
const STREAK = '#f59e0b'

function History() {
  const navigate = useNavigate()
  const [daysAgo, setDaysAgo] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const dateKey = dateString(date)
  const isCurrentDay = daysAgo === 0

  const { data, isLoading, isError, refetch } = useHistory(dateKey)
  const stats = useStats()
  const dayStat = stats.data?.heatmap.find((h) => h.date === dateKey)
  const targetHit = dayStat?.hit ?? null

  const prev = () => setDaysAgo((d) => d + 1)
  const next = () => setDaysAgo((d) => Math.max(0, d - 1))

  const pad = (n: number) => String(n).padStart(2, '0')
  const isoDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const now = new Date()
  const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const jumpToDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const picked = new Date(y, m - 1, d)
    const diff = Math.round((today.getTime() - picked.getTime()) / 86_400_000)
    setDaysAgo(Math.max(0, diff))
  }

  const keyActions: Array<KeyAction> = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 'n', description: 'Home', action: () => navigate({ to: '/' }) },
    {
      key: 't',
      description: 'Tasks',
      action: () => navigate({ to: '/tasks' }),
    },
    {
      key: '=',
      description: 'New task',
      shift: true,
      action: () => navigate({ to: '/new-task' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => navigate({ to: '/stats' }),
    },
    { key: 'left', description: 'Previous day', action: prev },
    { key: 'right', description: 'Next day', action: next },
  ]
  useKeyAction(keyActions)

  const entries = data ?? []
  const totalMinutes = entries.reduce(
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- snapshots predate this column; may be undefined at runtime
    (acc, e) => acc + (e.taskSnapshot.timeFrame ?? 0),
    0,
  )
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  // Minutes-per-tag for the viewed day, same timeFrame basis as "Time spent".
  const tagMinutes = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- snapshots predate this column; may be undefined at runtime
      const m = e.taskSnapshot.timeFrame ?? 0
      if (m <= 0) continue
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- snapshots predate this column; may be undefined at runtime
      for (const tag of e.taskSnapshot.tags ?? []) {
        map.set(tag, (map.get(tag) ?? 0) + m)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])
  const maxTagMin = tagMinutes[0]?.[1] ?? 0

  const relLabel = formatDaysAgo(daysAgo)

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="flex flex-col gap-4 px-5 pt-2 pb-6 md:flex-row md:items-end md:justify-between md:px-10">
        <PageHeading eyebrow="past completions">History</PageHeading>

        <div className="flex items-center justify-between gap-3 font-mono md:justify-end">
          <button
            type="button"
            onClick={prev}
            aria-label="Previous day"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 hover:border-zinc-600"
          >
            ←
          </button>
          <div className="relative text-center">
            <input
              type="date"
              value={isoDate}
              max={todayIso}
              onChange={(e) => jumpToDate(e.target.value)}
              aria-label="Jump to a date"
              className="absolute inset-0 z-10 cursor-pointer opacity-0"
            />
            <div
              className="dtn-heading text-zinc-100 uppercase"
              style={{
                fontSize: '1.05rem',
                letterSpacing: '0.15em',
                lineHeight: 1,
              }}
            >
              {format(date, 'EEE · LLL d')}
            </div>
            <div className="mt-1 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              {relLabel} · tap to jump
            </div>
          </div>
          <button
            type="button"
            onClick={next}
            disabled={daysAgo === 0}
            aria-label="Next day"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 text-zinc-300 hover:border-zinc-600 disabled:opacity-30 disabled:hover:border-zinc-800"
          >
            →
          </button>
        </div>
      </div>

      <div className="mb-6 px-5 md:px-10">
        <div className="grid grid-cols-2 gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-4 font-mono md:grid-cols-4 md:gap-6 md:px-6 md:py-5">
          <Stat
            label="Completed"
            value={String(entries.length)}
            unit={entries.length === 1 ? 'task' : 'tasks'}
          />
          <Stat
            label="Time spent"
            value={mins === 0 ? `${hours}h` : `${hours}h ${mins}m`}
            unit=""
          />
          <Stat
            label="On this day"
            value={format(date, 'd')}
            unit={format(date, 'LLL')}
          />
          {isCurrentDay ? (
            <Stat
              label="Hit target"
              value="not yet"
              unit="⚡"
              accent={STREAK}
            />
          ) : targetHit === null ? (
            <Stat label="Hit target" value="—" unit="" />
          ) : targetHit ? (
            <Stat label="Hit target" value="yes" unit="✓" accent={ACCENT} />
          ) : (
            <Stat label="Hit target" value="no" unit="✕" accent={OVERDUE} />
          )}
        </div>
      </div>

      {!isLoading && tagMinutes.length > 0 && (
        <div className="mb-6 px-5 md:px-10">
          <div className="mb-2 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
            Time by tag
          </div>
          <div className="flex flex-col gap-1.5">
            {tagMinutes.map(([tag, m]) => (
              <div
                key={tag}
                className="flex items-center gap-3 font-mono text-xs"
              >
                <span className="w-24 shrink-0 truncate text-zinc-300">
                  #{tag}
                </span>
                <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-900">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${maxTagMin > 0 ? (m / maxTagMin) * 100 : 0}%`,
                      background: ACCENT,
                    }}
                  />
                </span>
                <span className="w-14 shrink-0 text-right text-zinc-500">
                  {minutesToHours(m)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-20">
        {isLoading ? (
          <TaskListSkeleton rows={5} />
        ) : isError && entries.length === 0 ? (
          <div className="mt-8 flex justify-center">
            <ErrorState
              message="Couldn't load this day's history."
              onRetry={() => refetch()}
            />
          </div>
        ) : entries.length === 0 ? (
          <div className="mt-8 text-center font-mono text-sm text-zinc-500">
            Nothing completed.
          </div>
        ) : (
          <>
            <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
              {entries.length} completed · sorted by time
            </div>
            <div className="flex flex-col gap-1.5">
              {entries.map((e) => (
                <CompletedRow key={e.id} entry={e} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="fixed right-10 bottom-6 left-10 hidden md:block">
        <KeyHints
          items={[
            ['←', 'previous day'],
            ['→', 'next day'],
            ['Esc', 'home'],
          ]}
        />
      </div>
    </div>
  )
}

const Stat = ({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: string
  unit: string
  accent?: string
}) => (
  <div>
    <div className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
      {label}
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <span
        className="dtn-heading tabular-nums"
        style={{
          color: accent ?? '#fafafa',
          fontSize: '1.75rem',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {unit && <span className="text-xs text-zinc-500">{unit}</span>}
    </div>
  </div>
)

const CompletedRow = ({ entry }: { entry: HistoryEntry }) => {
  const task = entry.taskSnapshot
  const completed = new Date(entry.completedAt)
  const completedLabel = completed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <div className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 font-mono">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: ACCENT, color: ACCENT }}
      >
        ✓
      </span>
      <span className="text-2xl leading-none">{task.emoji}</span>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-zinc-300"
          style={{
            fontSize: '1.1rem',
            lineHeight: 1.15,
            textDecoration: 'line-through',
            textDecorationColor: 'rgba(255,255,255,0.25)',
          }}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-zinc-500">
          <span>at {completedLabel}</span>
          {task.dueTime && <span>due {task.dueTime}</span>}
          {task.timeFrame ? (
            <span>{minutesToHours(task.timeFrame)}</span>
          ) : null}
          {(task.tags ?? []).map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
