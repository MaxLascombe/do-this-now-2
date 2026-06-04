import { useArchivedTasks, useUnarchiveTask } from '@dtn/shared/queries'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TopBar } from '../components/TopBar'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/archive')({
  head: () => ({ meta: [{ title: 'Archive · Do This Now' }] }),
  component: Archive,
})

function Archive() {
  const navigate = useNavigate()
  const { data, isLoading } = useArchivedTasks()
  const unarchive = useUnarchiveTask()
  const [sheetOpen, setSheetOpen] = useState(false)

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

  const tasks = data ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="hidden from active lists">Archive</PageHeading>
      </div>

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-24">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loading />
            </div>
          ) : tasks.length === 0 ? (
            <p className="py-8 text-center font-mono text-sm text-zinc-600">
              No archived tasks. Archive a task to hide it from your active
              lists without deleting it.
            </p>
          ) : (
            tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-3 font-mono"
              >
                <span aria-hidden="true" className="text-2xl leading-none">
                  {t.emoji}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {t.title}
                </span>
                <button
                  type="button"
                  onClick={() => unarchive.mutate(t.id)}
                  className="shrink-0 rounded-full border border-zinc-800 px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50"
                >
                  Unarchive
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
