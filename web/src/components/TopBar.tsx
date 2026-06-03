import { formatScheduleStatus } from '@dtn/shared/format'
import { useProgressToday } from '@dtn/shared/queries'
import { MINUTES_IN_DAY, START_OF_DAY_MINUTES } from '@dtn/shared/time'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'

import { useDate } from '../hooks/useDate'
import { ProgressBlocks, ProgressPopover } from './ProgressBar'
import { RunningTimerChip } from './RunningTimerChip'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'

type NavItem = {
  id: 'home' | 'tasks' | 'new' | 'history' | 'stats'
  label: string
  to: string
  kbd: string
}

const ALL_NAV: ReadonlyArray<NavItem> = [
  { id: 'home', label: 'Now', to: '/', kbd: 'N' },
  { id: 'tasks', label: 'Tasks', to: '/tasks', kbd: 'T' },
  { id: 'new', label: 'New', to: '/new-task', kbd: '+' },
  { id: 'history', label: 'History', to: '/history', kbd: 'H' },
  { id: 'stats', label: 'Stats', to: '/stats', kbd: 'A' },
] as const

const activeIdFromPath = (pathname: string): NavItem['id'] => {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/new-task')) return 'new'
  if (pathname.startsWith('/history')) return 'history'
  if (pathname.startsWith('/stats')) return 'stats'
  return 'home'
}

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
    {children}
  </kbd>
)

export const TopBar = () => {
  const { pathname } = useLocation()
  const active = activeIdFromPath(pathname)
  const [open, setOpen] = useState(false)
  const progress = useProgressToday()
  const now = useDate()
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation()
        e.preventDefault()
        setOpen(false)
      }
    }
    // Skip the click that opened the popover.
    const t = setTimeout(
      () => document.addEventListener('mousedown', onDown),
      0,
    )
    document.addEventListener('keydown', onKey, true)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const pct = progress.data
    ? Math.min(100, Math.round((progress.data.done / progress.data.todo) * 100))
    : 0

  let scheduleShort: string | null = null
  let points = 0
  if (progress.data) {
    const { done, todo, lives, minutesToReduceTomorrowDays } = progress.data
    const maxTodo = Math.max(todo, minutesToReduceTomorrowDays)
    const timeOfDay = now.getHours() * 60 + now.getMinutes()
    const pctOfDay = Math.max(
      0,
      Math.min(
        1,
        (timeOfDay - START_OF_DAY_MINUTES) /
          (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
      ),
    )
    const shouldBeDone = maxTodo * pctOfDay
    const isBeforeWorkday = timeOfDay < START_OF_DAY_MINUTES
    scheduleShort = formatScheduleStatus({
      done,
      shouldBeDone,
      isBeforeWorkday,
      short: true,
    })
    const doneUsingAllLives = Math.min(done, todo - lives)
    const doneUsingLives = Math.min(done, todo)
    points =
      doneUsingAllLives +
      (doneUsingLives - doneUsingAllLives) * 2 +
      (done - doneUsingLives) * 3
  }

  return (
    <div className="hidden md:block">
      <div className="absolute top-0 right-0 left-0 z-10 h-[2px] bg-zinc-900">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: pct + '%', background: ACCENT }}
        />
      </div>

      <div className="relative flex items-center justify-between px-10 py-5 font-mono text-sm">
        <div ref={wrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Today's progress"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={
              '-mx-3 flex items-center gap-5 rounded-lg px-3 py-1.5 transition-colors ' +
              (open ? 'bg-zinc-900' : 'hover:bg-zinc-900/50')
            }
          >
            {progress.data ? (
              <>
                <span className="flex items-center gap-1.5 text-zinc-400">
                  <span className="text-zinc-100">★</span>
                  <span className="tabular-nums">{points}</span>
                </span>
                <span
                  className="flex items-center gap-1.5"
                  style={{ color: STREAK }}
                >
                  <span>▲</span>
                  <span className="tabular-nums">{progress.data.streak}</span>
                </span>
                <span style={{ color: ACCENT }}>{scheduleShort}</span>
              </>
            ) : null}
            <ProgressBlocks />
          </button>
          {open && <ProgressPopover />}
        </div>

        <div className="flex items-center gap-3">
          <RunningTimerChip />
        </div>

        <nav aria-label="Primary" className="flex items-center gap-1">
          {ALL_NAV.map((it) => {
            const isActive = it.id === active
            return (
              <Link
                key={it.id}
                to={it.to}
                aria-current={isActive ? 'page' : undefined}
                className={
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors ' +
                  (isActive
                    ? 'bg-zinc-50 text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100')
                }
              >
                <span>{it.label}</span>
                <Kbd>{it.kbd}</Kbd>
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
