import { useAllTasks, useTaskTimer } from '@dtn/shared/queries'
import { currentTimerSeconds } from '@dtn/shared/timer-utils'
import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

const ACCENT = '#34d399'

function formatTimerSeconds(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

/**
 * Global timer indicator that lives in the top bar. Shows the first
 * currently-running task (almost always the only one) with its emoji
 * and live elapsed time, plus an inline pause button so the user can
 * stop a forgotten timer from anywhere in the app. Clicking the chip
 * jumps to the task's edit page where the full widget lives.
 */
export function RunningTimerChip() {
  const tasks = useAllTasks()
  const timer = useTaskTimer()
  const [now, setNow] = useState(() => new Date())
  const running = (tasks.data ?? []).find((t) => t.timerStartedAt !== null)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])
  if (!running) return null
  const elapsed = currentTimerSeconds(running, now)

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-xs"
      style={{
        borderColor: 'rgba(52,211,153,0.35)',
        background: 'rgba(52,211,153,0.08)',
        color: ACCENT,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: ACCENT,
          boxShadow: '0 0 6px rgba(52,211,153,0.7)',
          animation: 'pulse 1.4s ease-in-out infinite',
        }}
      />
      <Link
        to="/tasks/$id/edit"
        params={{ id: running.id }}
        className="flex items-center gap-1.5 hover:opacity-80"
        title={`${running.title} — open`}
      >
        <span className="text-base leading-none">{running.emoji}</span>
        <span className="tabular-nums">{formatTimerSeconds(elapsed)}</span>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          timer.mutate({ id: running.id, action: { kind: 'pause' } })
        }}
        disabled={timer.isPending}
        aria-label="Pause timer"
        className="-mr-1 rounded-full px-1.5 leading-none hover:bg-emerald-500/15 disabled:opacity-40"
      >
        ⏸
      </button>
    </div>
  )
}
