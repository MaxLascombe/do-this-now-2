import { useCreateTask } from '@dtn/shared/queries'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import TaskForm from '../components/TaskForm'
import { TopBar } from '../components/TopBar'

export const Route = createFileRoute('/new-task')({
  head: () => ({ meta: [{ title: 'New Task · Do This Now' }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { title?: string; due?: string } => {
    const out: { title?: string; due?: string } = {}
    if (typeof search.title === 'string' && search.title.trim())
      out.title = search.title.trim()
    if (typeof search.due === 'string' && search.due.trim())
      out.due = search.due.trim()
    return out
  },
  component: NewTask,
})

function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()
  const { title, due } = Route.useSearch()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="flex items-end justify-between px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="create new">New task</PageHeading>
        <button
          type="button"
          onClick={() => router.history.back()}
          className="hidden items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50 md:flex"
        >
          <span>←</span>
          <span>Back</span>
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
            Esc
          </kbd>
        </button>
      </div>

      {mutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <Loading />
        </div>
      )}

      <TaskForm
        title={title}
        due={due}
        errorMessage={mutation.error?.message ?? null}
        isSaving={mutation.isPending}
        onCancel={() => router.history.back()}
        submitForm={(input) =>
          mutation.mutate(input, {
            onSuccess: () => router.history.back(),
          })
        }
      />
    </div>
  )
}
