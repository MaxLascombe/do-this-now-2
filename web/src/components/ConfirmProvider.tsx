import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

type ConfirmOptions = {
  title?: string
  message: string
  confirmLabel?: string
}

type PendingConfirm = {
  options: ConfirmOptions
  resolve: (ok: boolean) => void
}

const ConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null)

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm)
    throw new Error('useConfirm must be used within a ConfirmProvider')
  return confirm
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ options, resolve })),
    [],
  )

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={pending !== null}
        onClose={() => settle(false)}
        className="relative z-50"
      >
        <DialogBackdrop className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-mono">
            <DialogTitle className="text-[10px] tracking-[0.3em] uppercase text-zinc-500">
              {pending?.options.title ?? 'Are you sure?'}
            </DialogTitle>
            <p className="mt-3 text-sm text-zinc-200">
              {pending?.options.message}
            </p>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => settle(false)}
                className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => settle(true)}
                className="rounded-full bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
              >
                {pending?.options.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </ConfirmContext.Provider>
  )
}
