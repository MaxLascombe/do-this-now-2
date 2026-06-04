import { newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import { TaskRow } from '../components/TaskRow'
import { TopBar } from '../components/TopBar'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'

export const Route = createFileRoute('/tags')({
  head: () => ({ meta: [{ title: 'Tags · Do This Now' }] }),
  validateSearch: (search: Record<string, unknown>): { tag?: string } => {
    const tag = typeof search.tag === 'string' ? search.tag.trim() : ''
    return tag ? { tag } : {}
  },
  component: TagBrowse,
})

function TagBrowse() {
  const navigate = useNavigate()
  const { data, isLoading } = useAllTasks()
  const { tag: initialTag } = Route.useSearch()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(initialTag ?? null)

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

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data ?? [])
      for (const tag of t.tags) m.set(tag, (m.get(tag) ?? 0) + 1)
    return [...m.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )
  }, [data])

  // Fall back to the most-used tag if the selected one no longer exists
  // (a stale ?tag= deep-link, or its tasks were all deleted/retagged).
  const activeTag =
    selected !== null && tagCounts.some(([t]) => t === selected)
      ? selected
      : (tagCounts[0]?.[0] ?? null)
  const tagged = useMemo(
    () =>
      (data ?? [])
        .filter((t) => activeTag !== null && t.tags.includes(activeTag))
        .sort(
          (a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
        ),
    [data, activeTag],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="browse by tag">Tags</PageHeading>
      </div>

      <div className="flex-1 px-5 pb-28 md:px-10 md:pb-24">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loading />
            </div>
          ) : tagCounts.length === 0 ? (
            <p className="py-8 text-center font-mono text-sm text-zinc-600">
              No tags yet. Add tags to tasks to organize and browse them here.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {tagCounts.map(([tag, count]) => {
                  const isActive = tag === activeTag
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelected(tag)}
                      aria-pressed={isActive}
                      className={
                        'flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm transition-colors ' +
                        (isActive
                          ? 'border-zinc-100 bg-zinc-50 text-zinc-950'
                          : 'border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100')
                      }
                    >
                      <span>#{tag}</span>
                      <span
                        className={
                          'tabular-nums ' +
                          (isActive ? 'text-zinc-500' : 'text-zinc-600')
                        }
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>

              {activeTag !== null && (
                <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
                  <span>#{activeTag}</span>
                  <button
                    type="button"
                    onClick={() =>
                      navigate({ to: '/new-task', search: { tag: activeTag } })
                    }
                    className="rounded-full border border-zinc-800 px-3 py-1 tracking-normal text-zinc-400 normal-case hover:bg-zinc-900 hover:text-zinc-50"
                  >
                    + New task
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {tagged.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onClick={() =>
                      navigate({ to: '/tasks/$id', params: { id: t.id } })
                    }
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
