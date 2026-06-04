import { Link } from '@tanstack/react-router'

export function NotFound() {
  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="font-mono text-[10px] tracking-[0.4em] text-zinc-500 uppercase">
        404
      </div>
      <h1
        className="dtn-task-title text-zinc-50"
        style={{ fontSize: '2.5rem', lineHeight: 1.05 }}
      >
        Nothing here.
      </h1>
      <p className="max-w-xs font-mono text-sm text-zinc-500">
        That page doesn’t exist — it may have moved, or never did.
      </p>
      <Link
        to="/"
        className="rounded-full border border-zinc-700 bg-zinc-900 px-6 py-2.5 font-mono text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
      >
        Back to Now
      </Link>
    </div>
  )
}
