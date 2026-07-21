import { useTaskTimer } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
  timerAtPlan,
} from '@dtn/shared/timer-utils'
import { Pause, Play, SlidersVertical } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useConfirm } from './ConfirmProvider'
import { TimerAdjustModal } from './TimerAdjustModal'
import type { Task } from '@dtn/shared/types'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'
const PULSE_MS = 1400

// Focus Pulse: one visual beat on the rising edge of "elapsed reached the
// planned time" — never on mount (opening the app past plan is not the
// moment), never twice for the same task.
function usePlanPulse(taskId: string, atPlan: boolean): boolean {
  const prev = useRef<boolean | null>(null)
  const lastTask = useRef(taskId)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (lastTask.current !== taskId) {
      lastTask.current = taskId
      prev.current = null
    }
    const rising = prev.current === false && atPlan
    prev.current = atPlan
    if (!rising) return
    setPulsing(true)
    const t = setTimeout(() => setPulsing(false), PULSE_MS)
    return () => clearTimeout(t)
  }, [taskId, atPlan])
  return pulsing
}

const PULSE_STYLE = (
  <style>{`@keyframes dtn-plan-pulse {
    0% { transform: scale(1); }
    25% { transform: scale(1.12); text-shadow: 0 0 24px rgba(52,211,153,0.9); }
    100% { transform: scale(1); }
  }`}</style>
)

/**
 * The timer widget for a single task. If `task` is a 0-time-frame child,
 * pass the keeper task here instead — the widget always operates on the
 * row that owns the timer state.
 *
 * The mutation hook (useTaskTimer) targets the child id when called, and
 * the server resolves to the keeper. So callers can pass either object to
 * `task` but should pass the child id to `actionId` if the user is on a
 * child's detail view.
 */
export function TimerWidget({
  task,
  actionId,
  plannedMinutes,
  compact = false,
}: {
  task: Task
  actionId?: string
  plannedMinutes?: number
  compact?: boolean
}) {
  const id = actionId ?? task.id
  const timer = useTaskTimer()
  const confirm = useConfirm()
  const running = !!task.timerStartedAt

  // Tick once per second while running so the displayed value keeps
  // moving. When paused, `current` is constant so we skip the interval.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])
  const seconds = currentTimerSeconds(task, now)

  const plannedSec = (plannedMinutes ?? task.timeFrame) * 60
  const overrun = plannedSec > 0 && seconds > plannedSec * 1.5
  const pulsing = usePlanPulse(
    task.id,
    timerAtPlan(task, plannedMinutes ?? task.timeFrame, now),
  )
  const pulseAnim = pulsing
    ? { animation: `dtn-plan-pulse ${PULSE_MS}ms ease-out` }
    : undefined

  const dispatch = (kind: 'start' | 'pause' | 'reset') =>
    timer.mutate({ id, action: { kind } })
  const add = (sec: number) =>
    timer.mutate({ id, action: { kind: 'add', seconds: sec } })

  const [adjustOpen, setAdjustOpen] = useState(false)

  if (compact) {
    return (
      <>
        <div
          className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-3 font-mono"
          style={running ? { borderColor: ACCENT } : undefined}
        >
          <div className="flex items-center gap-3">
            {running && (
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: ACCENT,
                  animation: 'pulse 1.4s ease-in-out infinite',
                }}
              />
            )}
            <span
              className="tabular-nums"
              style={{
                fontSize: '1.875rem',
                fontWeight: 700,
                color: running ? ACCENT : '#fafafa',
                lineHeight: 1,
                display: 'inline-block',
                ...pulseAnim,
              }}
            >
              {formatTimerSeconds(seconds)}
            </span>
            {pulsing && PULSE_STYLE}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAdjustOpen(true)}
              disabled={timer.isPending}
              aria-label="Adjust timer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-sm text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-30"
            >
              <SlidersVertical size={16} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => dispatch(running ? 'pause' : 'start')}
              disabled={timer.isPending}
              aria-label={running ? 'Pause timer' : 'Start timer'}
              className={
                'flex h-11 w-11 items-center justify-center rounded-full text-lg transition-colors disabled:opacity-60 ' +
                (running
                  ? 'bg-amber-400/90 text-zinc-900 hover:bg-amber-400'
                  : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100')
              }
            >
              {running ? (
                <Pause size={18} fill="currentColor" aria-hidden />
              ) : (
                <Play size={18} fill="currentColor" aria-hidden />
              )}
            </button>
          </div>
        </div>
        <TimerAdjustModal
          open={adjustOpen}
          seconds={seconds}
          disabled={timer.isPending}
          onAdd={(m) => add(m * 60)}
          onClear={() => {
            dispatch('reset')
            setAdjustOpen(false)
          }}
          onClose={() => setAdjustOpen(false)}
        />
      </>
    )
  }

  return (
    <div
      className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 font-mono"
      style={running ? { borderColor: ACCENT } : undefined}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
          Timer
        </span>
        {running && (
          <span
            className="flex items-center gap-1.5 text-[10px] tracking-[0.3em] uppercase"
            style={{ color: ACCENT }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: ACCENT,
                animation: 'pulse 1.4s ease-in-out infinite',
              }}
            />
            running
          </span>
        )}
      </div>

      <div
        className="dtn-heading mt-2 tabular-nums"
        style={{
          fontSize: '3rem',
          color: running ? ACCENT : '#fafafa',
          lineHeight: 1,
          width: 'fit-content',
          ...pulseAnim,
        }}
      >
        {formatTimerSeconds(seconds)}
      </div>
      {pulsing && PULSE_STYLE}

      {overrun && (
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: 'rgba(245,158,11,0.4)',
            background: 'rgba(245,158,11,0.08)',
            color: STREAK,
          }}
        >
          Timer is &gt;1.5× the planned {Math.ceil(plannedSec / 60)} min —
          forgot to pause?
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => dispatch(running ? 'pause' : 'start')}
          disabled={timer.isPending}
          className={
            'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ' +
            (running
              ? 'bg-amber-400/90 text-zinc-900 hover:bg-amber-400'
              : 'bg-zinc-50 text-zinc-900 hover:bg-zinc-100')
          }
        >
          {running ? (
            <Pause size={16} fill="currentColor" aria-hidden />
          ) : (
            <Play size={16} fill="currentColor" aria-hidden />
          )}
          <span>{running ? 'Pause' : 'Start'}</span>
        </button>

        <button
          type="button"
          onClick={async () => {
            if (seconds === 0) return
            const ok = await confirm({
              message: 'Reset timer to 0?',
              confirmLabel: 'Reset',
            })
            if (!ok) return
            dispatch('reset')
          }}
          disabled={timer.isPending || seconds === 0}
          className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-100 disabled:opacity-30"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <AdjustButton onClick={() => add(-15 * 60)} disabled={timer.isPending}>
          −15m
        </AdjustButton>
        <AdjustButton onClick={() => add(-5 * 60)} disabled={timer.isPending}>
          −5m
        </AdjustButton>
        <AdjustButton onClick={() => add(-60)} disabled={timer.isPending}>
          −1m
        </AdjustButton>
        <AdjustButton onClick={() => add(60)} disabled={timer.isPending}>
          +1m
        </AdjustButton>
        <AdjustButton onClick={() => add(5 * 60)} disabled={timer.isPending}>
          +5m
        </AdjustButton>
        <AdjustButton onClick={() => add(15 * 60)} disabled={timer.isPending}>
          +15m
        </AdjustButton>
      </div>
    </div>
  )
}

function AdjustButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 disabled:opacity-30"
    >
      {children}
    </button>
  )
}
