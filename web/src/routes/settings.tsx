import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useAllTasks } from '@dtn/shared/queries'
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

function Settings() {
  const navigate = useNavigate()
  const { user } = useUser()
  const { signOut } = useClerk()
  const tasksQuery = useAllTasks()
  const [sheetOpen, setSheetOpen] = useState(false)

  const email = user?.primaryEmailAddress?.emailAddress
  const initial =
    user?.firstName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?'

  const keyActions: KeyAction[] = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 'n', description: 'Home', action: () => navigate({ to: '/' }) },
    { key: 't', description: 'Tasks', action: () => navigate({ to: '/tasks' }) },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    { key: 'a', description: 'Stats', action: () => navigate({ to: '/stats' }) },
  ]
  useKeyAction(keyActions)

  const download = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const onExportCsv = () => {
    const tasks = tasksQuery.data ?? []
    if (tasks.length === 0) return
    // Quote every field and double internal quotes so commas/newlines/tags
    // never break a row when opened in a spreadsheet.
    const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const header = [
      'Title',
      'Emoji',
      'Due',
      'Due time',
      'Repeat',
      'Estimate (min)',
      'Tags',
      'Notes',
      'Subtasks',
    ]
    const rows = tasks.map((t) =>
      [
        t.title,
        t.emoji,
        t.due,
        t.dueTime ?? '',
        t.repeat,
        Math.ceil(t.timeFrame),
        t.tags.join('; '),
        t.notes ?? '',
        t.subtasks.map((s) => s.title).join('; '),
      ]
        .map(cell)
        .join(','),
    )
    download(
      'do-this-now-tasks.csv',
      new Blob([[header.map(cell).join(','), ...rows].join('\r\n')], {
        type: 'text/csv',
      }),
    )
  }

  const taskCount = tasksQuery.data?.length ?? 0

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
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

          <button
            type="button"
            onClick={onExportCsv}
            disabled={taskCount === 0}
            className="flex items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-3 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span aria-hidden="true">⤓</span>
            Export tasks (CSV)
          </button>

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
