import { useSelection, useTask } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
} from '@dtn/shared/timer-utils'
import { Link, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { Task } from '@dtn/shared/types'

const ACCENT = '#34d399'

// Selection-driven (not timer-driven), so it persists while paused; there's no
// pause control — return to the Focus View to pause.
export function FocusReturnBar() {
  const { pathname } = useLocation()
  const selection = useSelection()
  const selectedId = selection.data?.selectedTaskId ?? null

  // Home is where the Focus View already lives — nothing to return to.
  if (!selectedId || pathname === '/') return null
  return <Bar id={selectedId} />
}

function Bar({ id }: { id: string }) {
  const task = useTask(id).data
  // A Child banks its time on its Keeper, so the running timer lives on the
  // Keeper row — resolve it the same way the Focus View's HeroTimer does.
  const keeper = useTask(task?.timekeeperId ?? '').data
  const timerTask: Task | undefined = task?.timekeeperId ? keeper : task
  const running = timerTask?.timerStartedAt != null

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])

  if (!task) return null
  const elapsed = timerTask ? currentTimerSeconds(timerTask, now) : 0

  return (
    <Link
      to="/"
      aria-label={`Return to ${task.title}`}
      title={`Return to ${task.title}`}
      className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 font-mono text-xs text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-900 hover:text-zinc-100"
    >
      <span className="text-sm leading-none">{task.emoji}</span>
      <span className="max-w-[9rem] truncate text-zinc-200">{task.title}</span>
      {running ? (
        <span className="tabular-nums" style={{ color: ACCENT }}>
          {formatTimerSeconds(elapsed)}
        </span>
      ) : (
        <span className="flex items-center gap-1 tabular-nums text-zinc-500">
          <span aria-hidden="true">⏸</span>
          {formatTimerSeconds(elapsed)}
        </span>
      )}
    </Link>
  )
}
