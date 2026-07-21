import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { describeRecapDay } from '@dtn/shared/progress-display'
import { useProgressRecap } from '@dtn/shared/queries'
import { useEffect, useState } from 'react'

const SEEN_KEY = 'dtn-recap-seen'
const MAX_LINES = 5

const WON = '#34d399'
const LOST = '#fb7185'

// The Day Recap: what lazy settlement (ADR-0004) decided while you were
// away — days won/lost, Lives banked or wiped, streak movement. Shown on
// Home's list state on the first open of a new day, equal weight for wins
// and losses, dismissed per day. First-ever run baselines silently instead
// of dumping two weeks of history.
export function RecapCard() {
  const q = useProgressRecap()
  const [seen, setSeen] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(SEEN_KEY),
  )

  const days = q.data ?? []
  const newest = days[0]?.date ?? null

  useEffect(() => {
    if (newest && seen === null) {
      localStorage.setItem(SEEN_KEY, newest)
      setSeen(newest)
    }
  }, [newest, seen])

  if (!newest || seen === null) return null
  const seenMs = newSafeDate(seen).getTime()
  const unseen = days.filter((d) => newSafeDate(d.date).getTime() > seenMs)
  if (unseen.length === 0) return null

  const dismiss = () => {
    localStorage.setItem(SEEN_KEY, newest)
    setSeen(newest)
  }

  const now = new Date()
  const yesterdayKey = dateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  )
  const title = (date: string) =>
    date === yesterdayKey
      ? 'Yesterday'
      : newSafeDate(date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })

  return (
    <div className="mb-5 w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 font-mono">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
          While you were away
        </span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss recap"
          className="-mr-1 px-1 text-zinc-500 hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {unseen.slice(0, MAX_LINES).map((d) => {
          const { headline, detail } = describeRecapDay(d)
          return (
            <div key={d.date} className="flex items-baseline gap-3 text-sm">
              <span className="w-24 shrink-0 text-zinc-500">{title(d.date)}</span>
              <span
                className="shrink-0 font-semibold"
                style={{ color: d.won ? WON : LOST }}
              >
                {headline}
              </span>
              <span className={d.won ? 'text-zinc-300' : 'text-rose-200/80'}>
                {detail}
              </span>
            </div>
          )
        })}
        {unseen.length > MAX_LINES && (
          <span className="text-xs text-zinc-500">
            +{unseen.length - MAX_LINES} more day
            {unseen.length - MAX_LINES === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  )
}
