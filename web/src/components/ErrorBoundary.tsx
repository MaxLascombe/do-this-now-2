import { Link } from '@tanstack/react-router'

export function ErrorBoundary({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-mono text-[10px] tracking-[0.4em] text-zinc-500 uppercase">
        Something broke
      </div>
      <h1
        className="dtn-task-title text-zinc-50"
        style={{ fontSize: '2.5rem', lineHeight: 1.05 }}
      >
        That didn’t go to plan.
      </h1>
      <p className="max-w-sm font-mono text-sm text-zinc-500">
        An unexpected error interrupted the page. Try again, or head back to
        Now.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-zinc-700 bg-zinc-900 px-6 py-2.5 font-mono text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
        >
          Try again
        </button>
        <Link
          to="/"
          className="rounded-full px-6 py-2.5 font-mono text-sm text-zinc-400 transition-colors hover:text-zinc-100"
        >
          Back to Now
        </Link>
      </div>
    </div>
  )
}
