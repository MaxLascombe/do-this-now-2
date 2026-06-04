import { newSafeDate } from '@dtn/shared/helpers'
import {
  heatmapCellPosition,
  heatmapColor,
  percentile,
} from '@dtn/shared/heatmap'
import { useStats } from '@dtn/shared/queries'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { KeyHints } from '../components/KeyHints'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TopBar } from '../components/TopBar'
import useKeyAction from '../hooks/useKeyAction'
import type { ReactNode } from 'react'
import type { KeyAction } from '../hooks/useKeyAction'
import type { StatsResult } from '@dtn/shared/types'

export const Route = createFileRoute('/stats')({
  head: () => ({ meta: [{ title: 'Stats · Do This Now' }] }),
  component: Stats,
})

const ACCENT = '#34d399'
const STREAK = '#f59e0b'

function Stats() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useStats()
  const [sheetOpen, setSheetOpen] = useState(false)

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
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
  ]
  useKeyAction(keyActions)

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <MobileChrome
          sheetOpen={sheetOpen}
          onOpenSheet={() => setSheetOpen(true)}
          onCloseSheet={() => setSheetOpen(false)}
        />
        <div className="flex flex-1 items-center justify-center">
          {isError && !isLoading ? (
            <ErrorState
              message="Couldn't load your stats."
              onRetry={() => refetch()}
            />
          ) : (
            <Loading />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="all the numbers">Stats</PageHeading>
      </div>

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-24">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <VanityCounters data={data} />
          <StreakSummary data={data} />
          <Heatmap data={data} />
          <DailyBars data={data} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <HourOfDay data={data} />
            <DayOfWeek data={data} />
          </div>
          <TopTasks data={data} />
          <EmojiMix data={data} />
          <Discipline data={data} />
        </div>
      </div>

      <div className="fixed right-10 bottom-6 left-10 hidden md:block">
        <KeyHints items={[['Esc', 'home']]} />
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
      <h2 className="mb-4 font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Counter({
  label,
  value,
  size = '2.25rem',
  color,
}: {
  label: string
  value: string | number
  size?: string
  color?: string
}) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
        {label}
      </div>
      <div
        className="dtn-heading mt-1 tabular-nums"
        style={{ fontSize: size, color: color ?? '#fafafa', lineHeight: 1 }}
      >
        {value}
      </div>
    </div>
  )
}

function VanityCounters({ data }: { data: StatsResult }) {
  return (
    <Section title="Completions">
      <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
        <Counter label="Today" value={data.totalToday} />
        <Counter label="This week" value={data.totalThisWeek} />
        <Counter label="This month" value={data.totalThisMonth} />
        <Counter label="All time" value={data.totalAllTime} />
      </div>
    </Section>
  )
}

function StreakSummary({ data }: { data: StatsResult }) {
  return (
    <Section title="Streak">
      <div className="grid grid-cols-3 gap-6">
        <Counter
          label="Current"
          value={`${data.currentStreak}d`}
          color={STREAK}
        />
        <Counter label="Longest" value={`${data.longestStreak}d`} />
        <Counter
          label="Days hit target"
          value={data.totalDaysHit}
          size="3rem"
        />
      </div>
    </Section>
  )
}

const HEATMAP_COLS = 26

function Heatmap({ data }: { data: StatsResult }) {
  const last = data.heatmap.at(-1)
  if (!last) return null
  const today = newSafeDate(last.date)
  const todayDow = today.getDay()
  type Cell = {
    date: string
    minutes: number
    hit: boolean
    col: number
    row: number
  }
  const cells: Array<Cell> = []
  for (let i = 0; i < data.heatmap.length; i++) {
    const { col, row } = heatmapCellPosition(
      i,
      data.heatmap.length,
      todayDow,
      HEATMAP_COLS,
    )
    cells.push({ ...data.heatmap[i], col, row })
  }
  const visible = cells.filter((c) => c.col >= 0)

  const nonZeroSorted = data.heatmap
    .map((d) => d.minutes)
    .filter((m) => m > 0)
    .sort((a, b) => a - b)
  const p33 = percentile(nonZeroSorted, 33)
  const p66 = percentile(nonZeroSorted, 66)

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <Section title="Last 6 months">
      <div className="flex justify-center gap-2 overflow-x-auto">
        <div className="flex flex-col gap-[3px] pr-1 font-mono text-[10px] text-zinc-600">
          {dayLabels.map((d, i) => (
            <div key={i} className="h-[14px] leading-[14px]">
              {d}
            </div>
          ))}
        </div>
        <div
          role="img"
          aria-label={`Activity over the last 6 months: ${nonZeroSorted.length} active ${
            nonZeroSorted.length === 1 ? 'day' : 'days'
          }, ${data.totalDaysHit} ${
            data.totalDaysHit === 1 ? 'day' : 'days'
          } hit the daily target.`}
          className="grid gap-[3px]"
          style={{
            gridTemplateColumns: `repeat(${HEATMAP_COLS}, 14px)`,
            gridTemplateRows: 'repeat(7, 14px)',
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
                  className="h-[14px] w-[14px] rounded-[2px]"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                />
              )
            }
            return (
              <div
                key={idx}
                title={`${cell.date}: ${cell.minutes} min${cell.hit ? ' · hit' : ''}`}
                className="h-[14px] w-[14px] rounded-[2px]"
                style={{
                  background: heatmapColor(cell.minutes, cell.hit, p33, p66),
                }}
              />
            )
          })}
        </div>
        <div className="ml-3 flex flex-col items-end justify-between font-mono text-[10px] text-zinc-600">
          <span>more</span>
          <div className="flex flex-col gap-[3px]">
            {[ACCENT, '#059669', '#065f46', 'rgba(255,255,255,0.04)'].map(
              (c) => (
                <div
                  key={c}
                  className="h-[14px] w-[14px] rounded-[2px]"
                  style={{ background: c }}
                />
              ),
            )}
          </div>
          <span>less</span>
        </div>
      </div>
    </Section>
  )
}

function DailyBars({ data }: { data: StatsResult }) {
  const days = data.last30Days
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const totalMinutes = days.reduce((a, d) => a + d.minutes, 0)
  const peakMinutes = days.length ? Math.max(...days.map((d) => d.minutes)) : 0
  return (
    <Section title="Last 30 days · minutes done">
      <div
        role="img"
        aria-label={`Minutes completed per day over the last 30 days. ${totalMinutes} minutes total${
          peakMinutes > 0 ? `, peak ${peakMinutes} minutes in a day` : ''
        }.`}
        className="flex h-24 items-end gap-[2px]"
      >
        {days.map((d, i) => {
          const opacity = 0.35 + 0.65 * (i / Math.max(1, days.length - 1))
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.minutes} min`}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(2, (d.minutes / max) * 100)}%`,
                background: ACCENT,
                opacity,
              }}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-600">
        <span>{days[0]?.date}</span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
    </Section>
  )
}

function HourOfDay({ data }: { data: StatsResult }) {
  const max = Math.max(...data.hourOfDay)
  const total = data.hourOfDay.reduce((a, b) => a + b, 0)
  const peakHour = data.hourOfDay.indexOf(max)
  if (total === 0) {
    return (
      <Section title="Hour of day">
        <div className="font-mono text-sm text-zinc-500">
          No completions yet.
        </div>
      </Section>
    )
  }
  return (
    <Section title="Hour of day">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] text-zinc-500">
        <span>
          {total} completion{total === 1 ? '' : 's'}
        </span>
        <span>peak {max}/hr</span>
      </div>
      <div
        role="img"
        aria-label={`Completions by hour of day. Busiest hour ${peakHour
          .toString()
          .padStart(2, '0')}:00 with ${max} completion${max === 1 ? '' : 's'}.`}
        className="flex h-20 items-end gap-[2px]"
      >
        {data.hourOfDay.map((c, i) => {
          const pct = (c / max) * 100
          return (
            <div
              key={i}
              title={`${i.toString().padStart(2, '0')}:00 — ${c} completion${c === 1 ? '' : 's'}`}
              className="flex-1 rounded-sm"
              style={{
                height: c === 0 ? '4px' : `${Math.max(8, pct)}%`,
                background: c === 0 ? 'rgba(255,255,255,0.06)' : '#e4e4e7',
                opacity: c === 0 ? 1 : 0.55 + (c / max) * 0.45,
              }}
            />
          )
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-zinc-600">
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
  const max = Math.max(...data.dayOfWeek)
  const total = data.dayOfWeek.reduce((a, b) => a + b, 0)
  const peakDay = labels[data.dayOfWeek.indexOf(max)]
  if (total === 0) {
    return (
      <Section title="Day of week">
        <div className="font-mono text-sm text-zinc-500">
          No completions yet.
        </div>
      </Section>
    )
  }
  return (
    <Section title="Day of week">
      <div className="mb-2 flex items-baseline justify-between font-mono text-[10px] text-zinc-500">
        <span>
          {total} completion{total === 1 ? '' : 's'}
        </span>
        <span>peak {max}</span>
      </div>
      <div
        role="img"
        aria-label={`Completions by day of week. Busiest day ${peakDay} with ${max} completion${max === 1 ? '' : 's'}.`}
        className="flex h-20 items-end gap-1.5"
      >
        {data.dayOfWeek.map((c, i) => {
          const pct = (c / max) * 100
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                title={`${labels[i]}: ${c}`}
                className="w-full rounded-sm"
                style={{
                  height: c === 0 ? '4px' : `${Math.max(8, pct)}%`,
                  background: c === 0 ? 'rgba(255,255,255,0.06)' : STREAK,
                  opacity: c === 0 ? 1 : 0.55 + (c / max) * 0.45,
                }}
              />
              <div className="font-mono text-[10px] text-zinc-600">
                {labels[i][0]}
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

function TopTasks({ data }: { data: StatsResult }) {
  if (data.topTasks.length === 0) {
    return (
      <Section title="Most-completed tasks">
        <div className="font-mono text-sm text-zinc-500">
          Nothing completed yet. Come back after you crush a few.
        </div>
      </Section>
    )
  }
  const max = data.topTasks[0].count
  return (
    <Section title="Most-completed tasks">
      <ul className="flex flex-col gap-2">
        {data.topTasks.map((t) => (
          <li key={t.title} className="flex items-center gap-3">
            <span className="w-7 text-lg">{t.emoji}</span>
            <span className="flex-1 truncate font-mono text-sm text-zinc-200">
              {t.title}
            </span>
            <div className="flex w-40 items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-900">
                <div
                  className="h-full"
                  style={{
                    width: `${(t.count / max) * 100}%`,
                    background: ACCENT,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="w-8 text-right font-mono text-xs text-zinc-400 tabular-nums">
                {t.count}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function EmojiMix({ data }: { data: StatsResult }) {
  if (data.emojiFreq.length === 0) return null
  const max = Math.max(1, ...data.emojiFreq.map((e) => e.count))
  return (
    <Section title="Your task mix">
      <ul className="flex flex-col gap-2">
        {data.emojiFreq.map((e) => (
          <li key={e.emoji} className="flex items-center gap-3">
            <span className="w-7 text-lg" aria-hidden="true">
              {e.emoji}
            </span>
            <div className="flex flex-1 items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded bg-zinc-900">
                <div
                  className="h-full"
                  style={{
                    width: `${(e.count / max) * 100}%`,
                    background: STREAK,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span className="w-8 text-right font-mono text-xs text-zinc-400 tabular-nums">
                {e.count}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function DisciplinePill({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
        {label}
      </div>
      <div
        className="dtn-heading mt-1 tabular-nums"
        style={{
          fontSize: '1.5rem',
          color: accent ?? '#fafafa',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Discipline({ data }: { data: StatsResult }) {
  return (
    <Section title="Discipline">
      <div className="grid grid-cols-2 gap-3">
        <DisciplinePill
          label="On-time"
          value={
            data.onTimeRate === null
              ? '—'
              : `${Math.round(data.onTimeRate * 100)}%`
          }
          accent={ACCENT}
        />
        <DisciplinePill
          label="Avg latency"
          value={
            data.avgLatencyDays === null
              ? '—'
              : `${data.avgLatencyDays.toFixed(1)}d`
          }
        />
        <DisciplinePill
          label="Snoozes / wk"
          value={String(data.snoozesThisWeek)}
        />
        <DisciplinePill
          label="Abandoned"
          value={String(data.abandonedCount)}
          accent="#fb7185"
        />
      </div>
    </Section>
  )
}
