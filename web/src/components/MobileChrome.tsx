import { progressCells, splitBarUnits } from '@dtn/shared/progress-display'
import { minutesOfDayToHHMM } from '@dtn/shared/settings'
import { minutesToHours } from '@dtn/shared/time'
import { Link, useLocation } from '@tanstack/react-router'
import { User } from 'lucide-react'
import { useEffect } from 'react'
import { activeNavFromPath, type NavId } from '../lib/nav'
import {
  ACCENT,
  LIVES,
  STREAK,
  cellColor,
  useComputedProgress,
} from './ProgressBar'
import { FocusReturnBar } from './FocusReturnBar'
import type { ReactNode } from 'react'

type ActiveTab = NavId

const MINI_CELLS = 14

export const MobileTopBar = ({ onOpenSheet }: { onOpenSheet: () => void }) => {
  const p = useComputedProgress()
  const { doneUnits: donePct, livesUnits: livesPct } = splitBarUnits({
    done: p?.done ?? 0,
    lives: p?.lives ?? 0,
    todo: p?.todo ?? 0,
    count: 100,
  })

  return (
    <div className="md:hidden">
      <div className="absolute top-0 right-0 left-0 z-10 flex h-[2px] bg-zinc-900">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: donePct + '%', background: ACCENT }}
        />
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: livesPct + '%', background: LIVES }}
        />
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenSheet}
          aria-label="Open progress detail"
          aria-haspopup="dialog"
          className="relative flex flex-1 items-center justify-between px-5 py-3 text-left font-mono text-[13px] active:bg-zinc-900/40"
        >
          <div className="flex items-center gap-3 text-zinc-400">
            {p && (
              <>
                <span
                  className="flex items-center gap-1"
                  style={{ color: STREAK }}
                >
                  <span>▲</span>
                  <span className="tabular-nums">{p.streak}</span>
                </span>
                <span
                  className="flex items-center gap-1"
                  style={{ color: LIVES }}
                >
                  <span>♥</span>
                  <span className="tabular-nums">
                    {minutesToHours(p.lives)}
                  </span>
                </span>
                <span style={{ color: ACCENT }}>{p.scheduleShort}</span>
              </>
            )}
          </div>
          <span className="inline-flex items-center gap-[2px]">
            {p &&
              progressCells({
                count: MINI_CELLS,
                done: p.done,
                lives: p.lives,
                todo: p.todo,
                shouldBeDone: p.shouldBeDone,
              }).map(({ key, fill, isTick }) => (
                <span
                  key={key}
                  style={{
                    width: 5,
                    height: 12,
                    background: cellColor(fill),
                    outline: isTick
                      ? '1px solid rgba(255,255,255,0.9)'
                      : undefined,
                    outlineOffset: isTick ? -1 : undefined,
                  }}
                />
              ))}
          </span>
        </button>
        <Link
          to="/settings"
          aria-label="Profile & settings"
          className="px-4 py-3 text-base text-zinc-500 active:text-zinc-200"
        >
          <User size={18} aria-hidden />
        </Link>
      </div>
      <div className="flex justify-center px-5 pb-2 empty:hidden">
        <FocusReturnBar />
      </div>
    </div>
  )
}

export const MobileTabBar = () => {
  const { pathname } = useLocation()
  const active = activeNavFromPath(pathname)
  const tabs: Array<{
    id: ActiveTab
    label: string
    glyph: string
    to: string
    primary?: boolean
  }> = [
    { id: 'home', label: 'Now', glyph: '◉', to: '/' },
    { id: 'tasks', label: 'Tasks', glyph: '☰', to: '/tasks' },
    { id: 'new', label: 'New', glyph: '＋', to: '/new-task', primary: true },
    { id: 'history', label: 'History', glyph: '◷', to: '/history' },
    { id: 'stats', label: 'Stats', glyph: '▤', to: '/stats' },
  ]

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-30 border-t border-zinc-900 bg-[#0a0a0b]/95 font-mono backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.5rem)' }}
    >
      <div className="grid grid-cols-5 px-2 pt-2 pb-2">
        {tabs.map((t) => {
          const isActive = t.id === active
          if (t.primary) {
            return (
              <Link
                key={t.id}
                to={t.to}
                className="flex justify-center"
                aria-label={t.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
                  style={{
                    background: '#fafafa',
                    color: '#0a0a0b',
                    boxShadow:
                      '0 6px 20px rgba(255,255,255,0.18), 0 0 0 4px rgba(250,250,250,0.06)',
                  }}
                >
                  {t.glyph}
                </span>
              </Link>
            )
          }
          return (
            <Link
              key={t.id}
              to={t.to}
              aria-current={isActive ? 'page' : undefined}
              className={
                'flex flex-col items-center gap-0.5 py-1 transition-colors ' +
                (isActive ? 'text-zinc-50' : 'text-zinc-500')
              }
            >
              <span className="text-base leading-none">{t.glyph}</span>
              <span className="text-[10px] tracking-wider uppercase">
                {t.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

const SheetStat = ({
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
    <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
      <span aria-hidden="true" style={{ color: iconColor ?? '#fafafa' }}>
        {icon}
      </span>
      <span>{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      )}
    </div>
    <div className="mt-1 flex items-baseline gap-1.5">
      <span
        className="dtn-heading tabular-nums text-zinc-100"
        style={{ fontSize: '1.25rem', lineHeight: 1 }}
      >
        {value}
      </span>
      <span className="text-[10px] text-zinc-500">{unit}</span>
    </div>
  </div>
)

export const MobileProgressSheet = ({ onClose }: { onClose: () => void }) => {
  const p = useComputedProgress()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onClose])
  if (!p) return null

  const SHEET_CELLS = 28
  const won = p.remainingToWin === 0 && p.todo > 0

  return (
    <div className="fixed inset-0 z-50 flex items-end md:hidden">
      <button
        type="button"
        aria-label="Close progress detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div
        className="relative w-full rounded-t-3xl border-t border-zinc-800 bg-[#0e0e10] px-5 pt-3 pb-8 font-mono"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        }}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
            Today · progress
          </span>
          <span className="text-xs text-zinc-500 tabular-nums">
            {new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </span>
        </div>
        <div className="flex items-center gap-[2px]">
          {progressCells({
            count: SHEET_CELLS,
            done: p.done,
            lives: p.lives,
            todo: p.todo,
            shouldBeDone: p.shouldBeDone,
          }).map(({ key, fill, isTick }) => (
            <span
              key={key}
              style={{
                flex: 1,
                height: 18,
                background: cellColor(fill),
                outline: isTick ? '1px solid rgba(255,255,255,0.9)' : undefined,
                outlineOffset: isTick ? -1 : undefined,
              }}
            />
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between">
          <span
            className="dtn-heading tabular-nums text-zinc-50"
            style={{ fontSize: '1.5rem' }}
          >
            {minutesToHours(p.done)}
            <span className="mx-1.5 text-zinc-600">/</span>
            <span className="text-zinc-400">{minutesToHours(p.todo)}</span>
          </span>
          <span className="text-sm tabular-nums" style={{ color: ACCENT }}>
            {p.scheduleShort}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4">
          <SheetStat
            icon="▲"
            iconColor={STREAK}
            label="Streak"
            value={p.streak}
            unit={`${p.streak === 1 ? 'day' : 'days'} · best ${p.bestStreak}`}
            active={p.streakIsActive}
          />
          <SheetStat
            icon="♥"
            iconColor={LIVES}
            label="Lives"
            value={minutesToHours(p.lives)}
            unit="banked"
          />
          <SheetStat
            icon="⏳"
            label="Remaining"
            value={minutesToHours(p.remainingToWin)}
            unit="to win"
            dim={won}
          />
          <SheetStat
            icon="◔"
            label="Win ETA"
            value={p.winEtaLabel}
            unit={won ? 'day won' : 'projected'}
          />
          <SheetStat
            icon="↥"
            iconColor={LIVES}
            label="Banking"
            value={`+${minutesToHours(p.banking)}`}
            unit="tomorrow's lives"
            dim={p.banking === 0}
          />
          <SheetStat
            icon="∞"
            label="Clear all"
            value={`~${p.daysUntilAllDone}d`}
            unit={p.clearByLabel}
          />
          <SheetStat
            icon="↻"
            label="Baseline"
            value={minutesToHours(p.theoreticalMinimum)}
            unit="recurring / day"
          />
          <SheetStat
            icon="◷"
            label="Workday"
            value={minutesOfDayToHHMM(p.workdayStartMin)}
            unit={`– ${minutesOfDayToHHMM(p.workdayEndMin)}`}
          />
        </div>
      </div>
    </div>
  )
}

// Convenience wrapper a route can drop in to get all mobile chrome at once.
export const MobileChrome = ({
  sheetOpen,
  onOpenSheet,
  onCloseSheet,
  hideProgress = false,
  children,
}: {
  sheetOpen: boolean
  onOpenSheet: () => void
  onCloseSheet: () => void
  // Settings is a "different place" — no progress bar or return bar there.
  hideProgress?: boolean
  children?: ReactNode
}) => (
  <>
    {!hideProgress && <MobileTopBar onOpenSheet={onOpenSheet} />}
    {children}
    <MobileTabBar />
    {sheetOpen && <MobileProgressSheet onClose={onCloseSheet} />}
  </>
)
