export const ErrorState = ({
  message = "Couldn't load.",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) => (
  <div
    role="alert"
    className="flex flex-col items-center gap-3 font-mono text-center"
  >
    <p className="text-sm text-zinc-400">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-zinc-800 px-4 py-1.5 text-xs text-zinc-300 hover:border-zinc-600 hover:text-zinc-100"
      >
        Retry
      </button>
    )}
  </div>
)
