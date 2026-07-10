import type { SubTask } from '@dtn/shared/types'

// The tickable subtask list, shared by the Focus View and the task detail
// page so a subtask row looks and behaves the same wherever it's worked
// through. Presentational: the caller owns the toggle mutation.
export const SubtaskList = ({
  subtasks,
  onToggle,
}: {
  subtasks: Array<SubTask>
  onToggle: (index: number) => void
}) => {
  if (subtasks.length === 0) return null
  const doneCount = subtasks.filter((s) => s.done).length

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
        <span>Subtasks</span>
        <span className="tabular-nums">
          {doneCount}/{subtasks.length}
        </span>
      </div>
      <ul className="space-y-1">
        {subtasks.map((sub, i) => (
          <li key={i} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={sub.done}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-2.5 text-left font-mono text-sm hover:border-zinc-700 hover:bg-zinc-900"
            >
              <span
                aria-hidden="true"
                className={sub.done ? 'text-emerald-400' : 'text-zinc-600'}
              >
                {sub.done ? '☑' : '☐'}
              </span>
              <span
                className={
                  'min-w-0 flex-1 truncate ' +
                  (sub.done ? 'text-zinc-500 line-through' : 'text-zinc-100')
                }
              >
                <span className="sr-only">
                  {sub.done ? 'Completed: ' : 'To do: '}
                </span>
                {sub.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
