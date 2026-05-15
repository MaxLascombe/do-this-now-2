import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { confirmMessage } from '@dtn/shared/timer-utils'
import { type Task } from '@dtn/shared/types'

export function CountConfirmModal({
  open,
  task,
  kind,
  onCancel,
  onSkip,
  onCount,
}: {
  open: boolean
  task: Task | null
  kind: 'over' | 'under' | null
  onCancel: () => void
  onSkip: () => void
  onCount: () => void
}) {
  const now = new Date()
  return (
    <Dialog open={open} onClose={onCancel} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-mono">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            ✕
          </button>
          <DialogTitle className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">
            Count this time?
          </DialogTitle>
          <p className="mt-3 text-sm text-zinc-200">
            {task && kind ? confirmMessage(task, now, kind) : ''}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-200 hover:border-zinc-500"
            >
              Don't count
            </button>
            <button
              type="button"
              onClick={onCount}
              className="rounded-full bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              Count it
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
