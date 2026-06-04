import { useClerk, useUser } from '@clerk/tanstack-react-start'
import { useAllTasks, useCreateTask } from '@dtn/shared/queries'
import { taskInputSchema } from '@dtn/shared/task-input'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'

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

  const onExport = () => {
    const tasks = tasksQuery.data ?? []
    if (tasks.length === 0) return
    const blob = new Blob([JSON.stringify(tasks, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'do-this-now-tasks.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const createTask = useCreateTask()
  const fileRef = useRef<HTMLInputElement>(null)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  // Accepts both the raw-task export above and any TaskInput-shaped JSON —
  // taskInputSchema strips server-only fields (id/userId/timers) and
  // validates the rest. Bad entries (and ones the server rejects) are
  // skipped, not fatal.
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportMsg(null)

    let raw: unknown
    try {
      raw = JSON.parse(await file.text())
    } catch {
      setImportMsg("Couldn't read that file — is it valid JSON?")
      return
    }
    if (!Array.isArray(raw)) {
      setImportMsg("That file isn't a task list.")
      return
    }

    setImporting(true)
    try {
      let imported = 0
      let skipped = 0
      for (const entry of raw) {
        const parsed = taskInputSchema.safeParse(entry)
        if (!parsed.success) {
          skipped++
          continue
        }
        try {
          // Drop the timekeeper link — the exported UUID won't resolve in
          // this account and would otherwise abort the whole import.
          await createTask.mutateAsync({ ...parsed.data, timekeeperId: null })
          imported++
        } catch {
          skipped++
        }
      }
      setImportMsg(
        `Imported ${imported} task${imported === 1 ? '' : 's'}` +
          (skipped ? `, skipped ${skipped}.` : '.'),
      )
    } finally {
      setImporting(false)
    }
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
            onClick={onExport}
            disabled={taskCount === 0}
            className="flex items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-3 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span aria-hidden="true">⤓</span>
            Export tasks (JSON)
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="flex items-center justify-center gap-2 rounded-full border border-zinc-800 px-4 py-3 font-mono text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <span aria-hidden="true">⤒</span>
            {importing ? 'Importing…' : 'Import tasks (JSON)'}
          </button>
          {importMsg && (
            <p
              role="status"
              className="-mt-3 text-center font-mono text-xs text-zinc-500"
            >
              {importMsg}
            </p>
          )}

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
