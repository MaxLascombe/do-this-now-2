import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useSettings, useUpdateSettings } from '@dtn/shared/queries'
import { minutesOfDayToHHMM, type UserSettings } from '@dtn/shared/settings'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TopBar } from '../components/TopBar'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/settings')({
  component: Settings,
})

const OVERDUE = '#fb7185'

// Every half hour of the day, as minutes-of-day. 1440 = end-of-day midnight.
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30)

const SettingsSelect = ({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string
  value: number
  options: number[]
  format: (v: number) => string
  onChange: (v: number) => void
}) => (
  <label className="flex items-center justify-between gap-3 font-mono text-sm">
    <span className="text-zinc-400">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10))}
      className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 tabular-nums"
    >
      {options.map((v) => (
        <option key={v} value={v}>
          {format(v)}
        </option>
      ))}
    </select>
  </label>
)

// Workday window + target horizon. Saves on every change — no ceremony.
const ProgressSettings = () => {
  const q = useSettings()
  const update = useUpdateSettings()
  if (!q.data) return null
  const s = q.data

  const save = (patch: Partial<UserSettings>) =>
    update.mutate({ ...s, ...patch })

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-6">
      <div className="text-[10px] tracking-[0.25em] text-zinc-500 uppercase">
        Progress
      </div>
      <SettingsSelect
        label="Workday starts"
        value={s.workdayStartMin}
        options={HALF_HOURS.filter((v) => v <= s.workdayEndMin - 30)}
        format={minutesOfDayToHHMM}
        onChange={(v) => save({ workdayStartMin: v })}
      />
      <SettingsSelect
        label="Workday ends"
        value={s.workdayEndMin}
        options={HALF_HOURS.filter((v) => v >= s.workdayStartMin + 30)}
        format={minutesOfDayToHHMM}
        onChange={(v) => save({ workdayEndMin: v })}
      />
      <SettingsSelect
        label="Target horizon"
        value={s.horizonDays}
        options={Array.from({ length: 60 }, (_, i) => i + 1)}
        format={(v) => `${v} day${v === 1 ? '' : 's'}`}
        onChange={(v) => save({ horizonDays: v })}
      />
      <p className="text-xs leading-relaxed text-zinc-500">
        The daily target averages the next {s.horizonDays} days of due work;
        pacing spreads it across the workday.
      </p>
    </div>
  )
}

function Settings() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()
  const [sheetOpen, setSheetOpen] = useState(false)

  const email = user?.primaryEmailAddress?.emailAddress
  const initial =
    user?.firstName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?'

  const keyActions: KeyAction[] = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 'n', description: 'Home', action: () => navigate({ to: '/' }) },
    {
      key: 't',
      description: 'Tasks',
      action: () => navigate({ to: '/tasks' }),
    },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => navigate({ to: '/stats' }),
    },
  ]
  useKeyAction(keyActions)

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
        hideProgress
      />

      <div className="px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="account">Settings</PageHeading>
      </div>

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-24">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-6 py-8">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900 font-mono text-3xl font-bold text-zinc-50">
              {initial}
            </div>
            {user?.fullName && (
              <div className="font-mono text-sm font-bold tracking-widest text-zinc-50 uppercase">
                {user.fullName}
              </div>
            )}
            {email && (
              <div className="font-mono text-xs text-zinc-500">{email}</div>
            )}
          </div>

          <ProgressSettings />

          <button
            type="button"
            onClick={() => signOut()}
            className="flex items-center justify-center gap-2 rounded-full border px-4 py-3 font-mono text-sm transition-colors"
            style={{ borderColor: 'rgba(251,113,133,0.3)', color: OVERDUE }}
          >
            <span aria-hidden="true">⏻</span>
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
