import { formatScheduleStatus } from '@dtn/shared/format'
import { computeSchedule } from '@dtn/shared/pacing'
import { useProgressToday } from '@dtn/shared/queries'
import { computePoints } from '@dtn/shared/scoring'
import { minutesToHours } from '@dtn/shared/time'
import { useRef } from 'react'

import { useDate } from '../hooks/useDate'
import { cells } from '../lib/progress-cells'

const CELLS = 24
const CELL_W = 6
const CELL_H = 12

const ACCENT = '#34d399'
const STREAK = '#f59e0b'

type Computed = {
  done: number
  todo: number
  shouldBeDone: number
  isBeforeWorkday: number
  scheduleShort: string
  points: number
  streak: number
  streakIsActive: boolean
  livesLeft: number
  livesUsed: number
  remaining: number
  reduceTomorrow: number
  daysUntilAllDone: number
  clearByLabel: string
}

export const useComputedProgress = (): Computed | null => {
  const now = useDate()
  const q = useProgressToday()
  if (!q.data) return null
  const {
    done,
    lives,
    streak,
    streakIsActive,
    todo,
    daysUntilAllDone,
    minutesToReduceTomorrowDays,
  } = q.data
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    minutesToReduceTomorrowDays,
  )

  const livesUsed = Math.min(lives, Math.max(0, todo - done))
  const livesLeft = lives - livesUsed

  const points = computePoints(done, todo, lives)

  const clearByDate = new Date(
    new Date().setDate(now.getDate() + daysUntilAllDone),
  )

  return {
    done,
    todo,
    shouldBeDone,
    isBeforeWorkday: isBeforeWorkday ? 1 : 0,
    scheduleShort: formatScheduleStatus({
      done,
      shouldBeDone,
      isBeforeWorkday,
      short: true,
    }),
    points,
    streak,
    streakIsActive,
    livesLeft,
    livesUsed,
    remaining: Math.max(0, todo - done),
    reduceTomorrow: Math.max(0, minutesToReduceTomorrowDays - done),
    daysUntilAllDone,
    clearByLabel: clearByDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }
}

export const ProgressBlocks = () => {
  const p = useComputedProgress()
  if (!p) return null
  const filledCount = Math.round((p.done / p.todo) * CELLS)
  const tickAt = Math.round((p.shouldBeDone / p.todo) * CELLS)

  return (
    <span
      className="inline-flex items-center gap-[2px]"
      title="Today's progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={p.todo}
      aria-valuenow={Math.min(p.done, p.todo)}
      aria-valuetext={`${minutesToHours(p.done)} of ${minutesToHours(p.todo)} done today`}
    >
      {cells(CELLS, filledCount, tickAt).map(({ key, filled, isTick }) => (
        <span
          key={key}
          style={{
            width: CELL_W,
            height: CELL_H,
            background: filled ? ACCENT : 'rgba(255,255,255,0.10)',
            outline: isTick ? '1px solid rgba(255,255,255,0.85)' : undefined,
            outlineOffset: isTick ? -1 : undefined,
          }}
        />
      ))}
    </span>
  )
}

const DetailRow = ({
  icon,
  iconColor,
  label,
  value,
  unit,
  dim,
  active,
}: {
  icon: string
  iconColor?: string
  label: string
  value: string | number
  unit: string
  dim?: boolean
  active?: boolean
}) => (
  <div className={dim ? 'opacity-60' : ''}>
    <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
      <span
        aria-hidden="true"
        className="text-sm leading-none"
        style={{ color: iconColor ?? '#fafafa' }}
      >
        {icon}
      </span>
      <span>{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      )}
    </div>
    <div className="mt-1 flex items-baseline gap-2">
      <span
        className="dtn-heading tabular-nums text-zinc-100"
        style={{ fontSize: '1.4rem', lineHeight: 1 }}
      >
        {value}
      </span>
      <span className="text-xs text-zinc-500">{unit}</span>
    </div>
  </div>
)

const POPOVER_CELLS = 36

export const ProgressPopover = () => {
  const p = useComputedProgress()
  const ref = useRef<HTMLDivElement | null>(null)
  if (!p) return null

  const filledCount = Math.round((p.done / p.todo) * POPOVER_CELLS)
  const tickAt = Math.round((p.shouldBeDone / p.todo) * POPOVER_CELLS)
  const now = new Date()
  const nowLabel = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <div
      ref={ref}
      className="absolute top-[44px] left-0 z-50 w-[440px] rounded-2xl border border-zinc-800 bg-[#0d0d0e]/95 p-5 shadow-2xl shadow-black/40 backdrop-blur"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
          Today · progress
        </span>
        <span className="text-xs text-zinc-500 tabular-nums">{nowLabel}</span>
      </div>

      <div
        className="mt-3 flex items-center gap-[2px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.todo}
        aria-valuenow={Math.min(p.done, p.todo)}
        aria-valuetext={`${minutesToHours(p.done)} of ${minutesToHours(p.todo)} done today`}
      >
        {cells(POPOVER_CELLS, filledCount, tickAt).map(
          ({ key, filled, isTick }) => (
            <span
              key={key}
              style={{
                flex: 1,
                height: 16,
                background: filled ? ACCENT : 'rgba(255,255,255,0.10)',
                outline: isTick ? '1px solid rgba(255,255,255,0.9)' : undefined,
                outlineOffset: isTick ? -1 : undefined,
              }}
            />
          ),
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span
          className="dtn-heading tabular-nums"
          style={{ fontSize: '1.5rem', color: '#fafafa' }}
        >
          {minutesToHours(p.done)}
          <span className="mx-1.5 text-base text-zinc-600">/</span>
          <span className="text-zinc-400">{minutesToHours(p.todo)}</span>
        </span>
        <span className="text-sm text-emerald-400 tabular-nums">
          {p.scheduleShort}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4">
        <DetailRow icon="★" label="Points" value={p.points} unit="today" />
        <DetailRow
          icon="▲"
          iconColor={STREAK}
          label="Streak"
          value={p.streak}
          unit={p.streak === 1 ? 'day' : 'days'}
          active={p.streakIsActive}
        />
        <DetailRow
          icon="♥"
          label="Lives"
          value={minutesToHours(p.livesLeft)}
          unit="cushion left"
        />
        <DetailRow
          icon="⏳"
          label="Remaining"
          value={minutesToHours(p.remaining)}
          unit="to target"
        />
        <DetailRow
          icon="↓"
          label="Reduce tomorrow"
          value={minutesToHours(p.reduceTomorrow)}
          unit="if you push"
          dim={p.reduceTomorrow === 0}
        />
        <DetailRow
          icon="∞"
          label="Clear all by"
          value={`~${p.daysUntilAllDone}d`}
          unit={p.clearByLabel}
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-zinc-900 pt-4 text-[10px] tracking-[0.25em] text-zinc-600 uppercase">
        <span>workday 08:30 – 24:00</span>
        <span>tick = should-be-here</span>
      </div>
    </div>
  )
}
