import { formatScheduleStatus } from '@dtn/shared/format'
import { computeSchedule } from '@dtn/shared/pacing'
import {
  computeWinEta,
  formatWinEta,
  progressCells,
  type ProgressCellFill,
} from '@dtn/shared/progress-display'
import { useProgressToday } from '@dtn/shared/queries'
import { minutesOfDayToHHMM } from '@dtn/shared/settings'
import { minutesToHours } from '@dtn/shared/time'
import { useRef } from 'react'

import { useDate } from '../hooks/useDate'

const CELLS = 24
const CELL_W = 6
const CELL_H = 12

export const ACCENT = '#34d399'
export const STREAK = '#f59e0b'
export const LIVES = '#38bdf8'

export const cellColor = (fill: ProgressCellFill): string =>
  fill === 'done' ? ACCENT : fill === 'lives' ? LIVES : 'rgba(255,255,255,0.10)'

type Computed = {
  done: number
  todo: number
  lives: number
  shouldBeDone: number
  scheduleShort: string
  streak: number
  bestStreak: number
  streakIsActive: boolean
  remainingToWin: number
  banking: number
  winEtaLabel: string
  reduceTomorrow: number
  theoreticalMinimum: number
  daysUntilAllDone: number
  clearByLabel: string
  workdayStartMin: number
  workdayEndMin: number
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
    bestStreak,
    todo,
    theoreticalMinimum,
    daysUntilAllDone,
    minutesToReduceTomorrowDays,
    workdayStartMin,
    workdayEndMin,
  } = q.data
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    workdayStartMin,
    workdayEndMin,
  )

  const clearByDate = new Date(
    new Date().setDate(now.getDate() + daysUntilAllDone),
  )

  return {
    done,
    todo,
    lives,
    shouldBeDone,
    scheduleShort: formatScheduleStatus({
      done,
      shouldBeDone,
      isBeforeWorkday,
      short: true,
    }),
    streak,
    bestStreak,
    streakIsActive,
    remainingToWin: Math.max(0, todo - done - lives),
    banking: Math.max(0, done + lives - todo),
    winEtaLabel: formatWinEta(
      computeWinEta({ now, done, lives, todo, workdayStartMin, workdayEndMin }),
    ),
    reduceTomorrow: Math.max(0, minutesToReduceTomorrowDays - done),
    theoreticalMinimum,
    daysUntilAllDone,
    clearByLabel: clearByDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    workdayStartMin,
    workdayEndMin,
  }
}

export const ProgressBlocks = () => {
  const p = useComputedProgress()
  if (!p) return null

  return (
    <span
      className="inline-flex items-center gap-[2px]"
      title="Today's progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={p.todo}
      aria-valuenow={Math.min(p.done + p.lives, p.todo)}
      aria-valuetext={`${minutesToHours(p.done)} of ${minutesToHours(p.todo)} done today, ${minutesToHours(p.lives)} banked`}
    >
      {progressCells({
        count: CELLS,
        done: p.done,
        lives: p.lives,
        todo: p.todo,
        shouldBeDone: p.shouldBeDone,
      }).map(({ key, fill, isTick }) => (
        <span
          key={key}
          style={{
            width: CELL_W,
            height: CELL_H,
            background: cellColor(fill),
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

  const now = new Date()
  const nowLabel = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const won = p.remainingToWin === 0 && p.todo > 0

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
        aria-valuenow={Math.min(p.done + p.lives, p.todo)}
        aria-valuetext={`${minutesToHours(p.done)} of ${minutesToHours(p.todo)} done today, ${minutesToHours(p.lives)} banked`}
      >
        {progressCells({
          count: POPOVER_CELLS,
          done: p.done,
          lives: p.lives,
          todo: p.todo,
          shouldBeDone: p.shouldBeDone,
        }).map(({ key, fill, isTick }) => (
          <span
            key={key}
            style={{
              flex: 1,
              height: 16,
              background: cellColor(fill),
              outline: isTick ? '1px solid rgba(255,255,255,0.9)' : undefined,
              outlineOffset: isTick ? -1 : undefined,
            }}
          />
        ))}
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
        <DetailRow
          icon="▲"
          iconColor={STREAK}
          label="Streak"
          value={p.streak}
          unit={`${p.streak === 1 ? 'day' : 'days'} · best ${p.bestStreak}`}
          active={p.streakIsActive}
        />
        <DetailRow
          icon="♥"
          iconColor={LIVES}
          label="Lives"
          value={minutesToHours(p.lives)}
          unit="banked"
        />
        <DetailRow
          icon="⏳"
          label="Remaining"
          value={minutesToHours(p.remainingToWin)}
          unit="to win"
          dim={won}
        />
        <DetailRow
          icon="◔"
          label="Win ETA"
          value={p.winEtaLabel}
          unit={won ? 'day won' : 'projected'}
        />
        <DetailRow
          icon="↥"
          iconColor={LIVES}
          label="Banking"
          value={`+${minutesToHours(p.banking)}`}
          unit="tomorrow's lives"
          dim={p.banking === 0}
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
        <DetailRow
          icon="↻"
          label="Baseline"
          value={minutesToHours(p.theoreticalMinimum)}
          unit="recurring / day"
        />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-zinc-900 pt-4 text-[10px] tracking-[0.25em] text-zinc-600 uppercase">
        <span>
          workday {minutesOfDayToHHMM(p.workdayStartMin)} –{' '}
          {minutesOfDayToHHMM(p.workdayEndMin)}
        </span>
        <span>tick = should-be-here</span>
      </div>
    </div>
  )
}
