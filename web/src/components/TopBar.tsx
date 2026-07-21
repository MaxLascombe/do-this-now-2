import { formatScheduleStatus } from '@dtn/shared/format'
import { computeSchedule } from '@dtn/shared/pacing'
import { splitBarUnits } from '@dtn/shared/progress-display'
import { useProgressToday } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import { Link, useLocation } from '@tanstack/react-router'
import { User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useDate } from '../hooks/useDate'
import { activeNavFromPath, type NavId } from '../lib/nav'
import {
  ACCENT,
  LIVES,
  STREAK,
  ProgressBlocks,
  ProgressPopover,
} from './ProgressBar'
import { FocusReturnBar } from './FocusReturnBar'

type NavItem = {
  id: NavId
  label: string
  to: string
  kbd: string
}

const ALL_NAV: ReadonlyArray<NavItem> = [
  { id: 'home', label: 'Now', to: '/', kbd: 'n' },
  { id: 'tasks', label: 'Tasks', to: '/tasks', kbd: 't' },
  { id: 'new', label: 'New', to: '/new-task', kbd: '+' },
  { id: 'history', label: 'History', to: '/history', kbd: 'h' },
  { id: 'stats', label: 'Stats', to: '/stats', kbd: 'a' },
] as const

const Kbd = ({ children }: { children: string }) => (
  <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
    {children}
  </kbd>
)

export const TopBar = () => {
  const { pathname } = useLocation()
  const active = activeNavFromPath(pathname)
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

  // Done fills green from the left, banked Lives extend the fill in their own
  // color; the shared split handles the no-tasks day and never reads 100%
  // before the day is actually won.
  const { doneUnits: donePct, livesUnits: livesPct } = splitBarUnits({
    done: progress.data?.done ?? 0,
    lives: progress.data?.lives ?? 0,
    todo: progress.data?.todo ?? 0,
    count: 100,
  })

  let scheduleShort: string | null = null
  if (progress.data) {
    const { done, todo, workdayStartMin, workdayEndMin } = progress.data
    const { shouldBeDone, isBeforeWorkday } = computeSchedule(
      now,
      todo,
      workdayStartMin,
      workdayEndMin,
    )
    scheduleShort = formatScheduleStatus({
      done,
      shouldBeDone,
      isBeforeWorkday,
      short: true,
    })
  }

  return (
    <div className="hidden md:block">
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

      <div className="relative flex items-center justify-between gap-6 px-10 py-5 font-mono text-sm">
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
                <span
                  className="flex items-center gap-1.5"
                  style={{ color: STREAK }}
                >
                  <span>▲</span>
                  <span className="tabular-nums">{progress.data.streak}</span>
                </span>
                <span
                  className="flex items-center gap-1.5"
                  style={{ color: LIVES }}
                >
                  <span>♥</span>
                  <span className="tabular-nums">
                    {minutesToHours(progress.data.lives)}
                  </span>
                </span>
                <span style={{ color: ACCENT }}>{scheduleShort}</span>
              </>
            ) : null}
            <ProgressBlocks />
          </button>
          {open && <ProgressPopover />}
        </div>

        <div className="flex items-center gap-3">
          <FocusReturnBar />
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
          <Link
            to="/settings"
            aria-label="Profile & settings"
            aria-current={pathname.startsWith('/settings') ? 'page' : undefined}
            className={
              'flex items-center rounded-full px-3 py-1.5 text-base transition-colors ' +
              (pathname.startsWith('/settings')
                ? 'bg-zinc-50 text-zinc-900'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100')
            }
          >
            <User size={18} aria-hidden />
          </Link>
        </nav>
      </div>
    </div>
  )
}
