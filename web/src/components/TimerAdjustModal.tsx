import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { formatTimerSeconds } from '@dtn/shared/timer-utils'

import { useConfirm } from './ConfirmProvider'

const ADJUST_AMOUNTS = [-15, -5, -1, 1, 5, 15] as const

export function TimerAdjustModal({
  open,
  seconds,
  disabled,
  onAdd,
  onClear,
  onClose,
}: {
  open: boolean
  seconds: number
  disabled: boolean
  onAdd: (minutes: number) => void
  onClear: () => void
  onClose: () => void
}) {
  const confirm = useConfirm()
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="relative w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-mono">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-xs text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100"
          >
            ✕
          </button>
          <DialogTitle className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">
            Adjust timer
          </DialogTitle>
          <div
            className="mt-3 text-center text-3xl font-bold tabular-nums text-zinc-50"
            style={{ lineHeight: 1.1 }}
          >
            {formatTimerSeconds(seconds)}
          </div>
          <div className="mt-5 grid grid-cols-6 gap-2">
            {ADJUST_AMOUNTS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onAdd(m)}
                disabled={disabled}
                className="rounded-full border border-zinc-800 px-2 py-2 text-xs text-zinc-200 hover:border-zinc-600 disabled:opacity-30"
              >
                {m > 0 ? `+${m}` : m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (seconds === 0) return
              const ok = await confirm({
                message: 'Clear timer to 0?',
                confirmLabel: 'Clear',
              })
              if (!ok) return
              onClear()
            }}
            disabled={disabled || seconds === 0}
            className="mt-5 w-full rounded-full border border-zinc-800 px-4 py-2.5 text-sm text-zinc-200 hover:border-zinc-600 disabled:opacity-30"
          >
            Clear timer
          </button>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
