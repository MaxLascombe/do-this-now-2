import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { newSafeDate } from '@dtn/shared/helpers'
import { useStats } from '@dtn/shared/queries'
import type { StatsResult } from '@dtn/shared/types'
import { createFileRoute, useNavigate } from '@tanstack/react-router'

import { Button } from '../components/Button'
import Hints from '../components/Hints'
import { Loading } from '../components/Loading'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/stats')({
  component: Stats,
})

function Stats() {
  const navigate = useNavigate()
  const { data, isLoading } = useStats()

  const keyActions: KeyAction[] = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
  ]
  useKeyAction(keyActions)

  if (isLoading || !data) {
    return (
      <div className="absolute inset-0 flex h-screen flex-col justify-center bg-black">
        <Loading />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-white">
      <div className="flex items-center gap-2">
        <Button onClick={() => navigate({ to: '/' })} icon={faArrowLeft} />
        <h1 className="text-2xl font-bold">Stats</h1>
      </div>

      <VanityCounters data={data} />
      <StreakSummary data={data} />
      <Heatmap data={data} />
      <DailyBars data={data} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <HourOfDay data={data} />
        <DayOfWeek data={data} />
      </div>
      <TopTasks data={data} />
      <EmojiBreakdown data={data} />
      <div className="grid grid-cols-2 gap-3">
        <Pill
          label="On-time"
          value={
            data.onTimeRate === null
              ? '—'
              : `${Math.round(data.onTimeRate * 100)}%`
          }
        />
        <Pill
          label="Avg latency"
          value={
            data.avgLatencyDays === null
              ? '—'
              : `${data.avgLatencyDays.toFixed(1)}d`
          }
        />
        <Pill label="Snoozes all time" value={String(data.snoozesAllTime)} />
        <Pill label="Snoozes this week" value={String(data.snoozesThisWeek)} />
        <Pill label="Abandoned" value={String(data.abandonedCount)} />
        <Pill
          label="Abandonment rate"
          value={
            data.abandonmentRate === null
              ? '—'
              : `${Math.round(data.abandonmentRate * 100)}%`
          }
        />
      </div>

      <Hints keyActions={keyActions} />
    </div>
  )
}

// ---------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-gray-500">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-950/40 px-3 py-2">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-xl font-semibold text-white">{value}</div>
    </div>
  )
}

function VanityCounters({ data }: { data: StatsResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Pill label="Today" value={String(data.totalToday)} />
      <Pill label="This week" value={String(data.totalThisWeek)} />
      <Pill label="This month" value={String(data.totalThisMonth)} />
      <Pill label="All-time" value={String(data.totalAllTime)} />
    </div>
  )
}

function StreakSummary({ data }: { data: StatsResult }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <Pill label="Current streak" value={`${data.currentStreak}d`} />
      <Pill label="Longest streak" value={`${data.longestStreak}d`} />
      <Pill label="Days hit target" value={String(data.totalDaysHit)} />
    </div>
  )
}

function Heatmap({ data }: { data: StatsResult }) {
  // 12 columns × 7 rows. The rightmost column is the current week; topmost
  // row is Sunday. Find each cell's (col, row) from its date.
  const last = data.heatmap[data.heatmap.length - 1]
  if (!last) return null
  // newSafeDate handles our YYYY-M-D format (unpadded). `new Date(...)`
  // returns Invalid Date for unpadded ISO strings on V8, which would
  // silently NaN the whole grid.
  const today = newSafeDate(last.date)
  const todayCol = 11
  const todayDow = today.getDay() // 0..6
  const cells: Array<{ date: string; hit: boolean; col: number; row: number }> = []
  for (let i = 0; i < data.heatmap.length; i++) {
    const offsetFromToday = data.heatmap.length - 1 - i
    const dowOffset = todayDow - offsetFromToday
    const colsBack = Math.ceil(-dowOffset / 7)
    const col = todayCol - colsBack
    const row = ((dowOffset % 7) + 7) % 7
    cells.push({ ...data.heatmap[i], col, row })
  }
  // Only show cells where col >= 0 (within the 12-week window).
  const visible = cells.filter((c) => c.col >= 0)

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Section title="Last 12 weeks">
      <div className="flex gap-2">
        <div className="flex flex-col gap-[3px] pr-1 text-[10px] text-gray-600">
          {dayLabels.map((d) => (
            <div key={d} className="h-3 leading-3">
              {d[0]}
            </div>
          ))}
        </div>
        <div
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: 'repeat(12, 12px)',
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
          }}
        >
          {Array.from({ length: 12 * 7 }).map((_, idx) => {
            const col = Math.floor(idx / 7)
            const row = idx % 7
            const cell = visible.find((c) => c.col === col && c.row === row)
            if (!cell) {
              return (
                <div
                  key={idx}
                  className="h-3 w-3 rounded-[2px] bg-gray-950/40"
                />
              )
            }
            return (
              <div
                key={idx}
                title={`${cell.date}: ${cell.hit ? 'hit' : 'miss'}`}
                className={
                  'h-3 w-3 rounded-[2px] ' +
                  (cell.hit ? 'bg-green-500' : 'bg-gray-800')
                }
              />
            )
          })}
        </div>
      </div>
    </Section>
  )
}

function DailyBars({ data }: { data: StatsResult }) {
  const max = Math.max(1, ...data.last30Days.map((d) => d.minutes))
  return (
    <Section title="Last 30 days · minutes done">
      <div className="flex h-24 items-end gap-[2px]">
        {data.last30Days.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.minutes} min`}
            className="flex-1 rounded-sm bg-blue-500/70 hover:bg-blue-400"
            style={{
              height: `${Math.max(2, (d.minutes / max) * 100)}%`,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-600">
        <span>{data.last30Days[0]?.date}</span>
        <span>{data.last30Days[data.last30Days.length - 1]?.date}</span>
      </div>
    </Section>
  )
}

function HourOfDay({ data }: { data: StatsResult }) {
  const max = Math.max(1, ...data.hourOfDay)
  return (
    <Section title="Hour of day">
      <div className="flex h-20 items-end gap-[1px]">
        {data.hourOfDay.map((c, i) => (
          <div
            key={i}
            title={`${i.toString().padStart(2, '0')}:00 — ${c} completions`}
            className="flex-1 rounded-sm bg-purple-500/70"
            style={{ height: `${Math.max(2, (c / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-gray-600">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </Section>
  )
}

function DayOfWeek({ data }: { data: StatsResult }) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const max = Math.max(1, ...data.dayOfWeek)
  return (
    <Section title="Day of week">
      <div className="flex h-20 items-end gap-1">
        {data.dayOfWeek.map((c, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div
              title={`${labels[i]}: ${c}`}
              className="w-full rounded-sm bg-amber-500/70"
              style={{ height: `${Math.max(2, (c / max) * 100)}%` }}
            />
            <div className="text-[10px] text-gray-600">{labels[i][0]}</div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function TopTasks({ data }: { data: StatsResult }) {
  if (data.topTasks.length === 0) {
    return (
      <Section title="Most-completed tasks">
        <div className="text-sm text-gray-500">
          Nothing completed yet. Come back after you crush a few.
        </div>
      </Section>
    )
  }
  const max = data.topTasks[0].count
  return (
    <Section title="Most-completed tasks">
      <ul className="space-y-2">
        {data.topTasks.map((t) => (
          <li key={t.title} className="flex items-center gap-3">
            <span className="w-5 text-lg">{t.emoji}</span>
            <span className="flex-1 truncate text-sm">{t.title}</span>
            <div className="flex w-32 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded bg-gray-900">
                <div
                  className="h-full bg-emerald-500/80"
                  style={{ width: `${(t.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right text-xs text-gray-400">
                {t.count}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function EmojiBreakdown({ data }: { data: StatsResult }) {
  if (data.emojiFreq.length === 0) {
    return (
      <Section title="Emoji breakdown">
        <div className="text-sm text-gray-500">No data yet.</div>
      </Section>
    )
  }
  const total = data.emojiFreq.reduce((a, b) => a + b.count, 0)
  const top = data.emojiFreq.slice(0, 12)
  return (
    <Section title="Emoji breakdown">
      <div className="flex flex-wrap gap-2">
        {top.map((e) => (
          <div
            key={e.emoji}
            className="flex items-center gap-2 rounded-md border border-gray-800 bg-gray-950 px-2 py-1"
          >
            <span className="text-base">{e.emoji}</span>
            <span className="text-xs text-gray-400">
              {e.count} · {Math.round((e.count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </Section>
  )
}
