import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Toast = {
  message: string
  actionLabel?: string
  onAction?: () => void
}

const ToastContext = createContext<((toast: Toast) => void) | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used within a ToastProvider')
  return show
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: Toast) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(next)
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current)
    setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 font-mono text-sm text-zinc-200 shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.()
                dismiss()
              }}
              className="rounded-full bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-900 hover:bg-zinc-100"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}
