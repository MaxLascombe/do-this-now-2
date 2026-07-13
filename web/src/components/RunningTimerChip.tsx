import { useAllTasks, useTaskTimer } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
} from '@dtn/shared/timer-utils'
import { Link } from '@tanstack/react-router'
import { Pause } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { Task } from '@dtn/shared/types'

const ACCENT = '#34d399'

/**
 * Global timer indicator that lives in the top bar. Shows every
 * currently-running task (usually just one) with its emoji and live
 * elapsed time, plus an inline pause button so the user can stop a
 * forgotten timer from anywhere in the app. Clicking a chip jumps Home,
 * where the running task is the Selected Task and its Focus View lives.
 */
export function RunningTimerChip() {
  const tasks = useAllTasks()
  const [now, setNow] = useState(() => new Date())
  const running = (tasks.data ?? []).filter((t) => t.timerStartedAt !== null)
  const anyRunning = running.length > 0
  useEffect(() => {
    if (!anyRunning) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [anyRunning])
  if (!anyRunning) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {running.map((task) => (
        <TimerChip key={task.id} task={task} now={now} />
      ))}
    </div>
  )
}

function TimerChip({ task, now }: { task: Task; now: Date }) {
  const timer = useTaskTimer()
  const elapsed = currentTimerSeconds(task, now)
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
        to="/"
        className="flex items-center gap-1.5 hover:opacity-80"
        title={`${task.title} — open`}
        aria-label={`Open running timer for ${task.title}`}
      >
        <span className="text-base leading-none">{task.emoji}</span>
        <span className="tabular-nums">{formatTimerSeconds(elapsed)}</span>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          timer.mutate({ id: task.id, action: { kind: 'pause' } })
        }}
        disabled={timer.isPending}
        aria-label={`Pause timer for ${task.title}`}
        className="-mr-1 flex items-center rounded-full px-1.5 leading-none hover:bg-emerald-500/15 disabled:opacity-40"
      >
        <Pause size={13} fill="currentColor" aria-hidden />
      </button>
    </div>
  )
}
