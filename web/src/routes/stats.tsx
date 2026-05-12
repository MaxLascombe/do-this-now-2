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

const HEATMAP_COLS = 26

// Pick a value at the p-th percentile (0..100) of an already-sorted array.
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(
    sorted.length - 1,
    Math.floor(((sorted.length - 1) * p) / 100),
  )
  return sorted[idx]
}

function heatmapColor(
  minutes: number,
  hit: boolean,
  p33: number,
  p66: number,
): string {
  if (minutes === 0) return 'bg-gray-800'
  if (hit || minutes >= p66) return 'bg-green-500'
  if (minutes >= p33) return 'bg-green-700'
  return 'bg-green-900'
}

function Heatmap({ data }: { data: StatsResult }) {
  // 26 columns × 7 rows ≈ 6 months. Color tiers come from percentiles of
  // the non-zero days in the visible window so the shading actually has
  // variation for a given user's output range (fixed minute thresholds
  // bucketed everything into one tier for daily-task power users).
  const last = data.heatmap[data.heatmap.length - 1]
  if (!last) return null
  const today = newSafeDate(last.date)
  const todayCol = HEATMAP_COLS - 1
  const todayDow = today.getDay()
  type Cell = {
    date: string
    minutes: number
    hit: boolean
    col: number
    row: number
  }
  const cells: Cell[] = []
  for (let i = 0; i < data.heatmap.length; i++) {
    const offsetFromToday = data.heatmap.length - 1 - i
    const dowOffset = todayDow - offsetFromToday
    const colsBack = Math.ceil(-dowOffset / 7)
    const col = todayCol - colsBack
    const row = ((dowOffset % 7) + 7) % 7
    cells.push({ ...data.heatmap[i], col, row })
  }
  const visible = cells.filter((c) => c.col >= 0)

  const nonZeroSorted = data.heatmap
    .map((d) => d.minutes)
    .filter((m) => m > 0)
    .sort((a, b) => a - b)
  const p33 = percentile(nonZeroSorted, 33)
  const p66 = percentile(nonZeroSorted, 66)

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <Section title="Last 6 months">
      <div className="flex justify-center gap-2 overflow-x-auto">
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
            gridTemplateColumns: `repeat(${HEATMAP_COLS}, 12px)`,
            gridTemplateRows: 'repeat(7, 12px)',
            gridAutoFlow: 'column',
          }}
        >
          {Array.from({ length: HEATMAP_COLS * 7 }).map((_, idx) => {
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
                title={`${cell.date}: ${cell.minutes} min${cell.hit ? ' · hit' : ''}`}
                className={
                  'h-3 w-3 rounded-[2px] ' +
                  heatmapColor(cell.minutes, cell.hit, p33, p66)
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
