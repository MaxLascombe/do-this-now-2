// Shimmer placeholder block. Compose these into page-shaped skeletons that
// stand in for content while it loads, instead of a lone spinner.
export const Skeleton = ({
  className = '',
  style,
}: {
  className?: string
  style?: React.CSSProperties
}) => (
  <div
    aria-hidden
    className={'animate-pulse rounded-md bg-zinc-800/70 ' + className}
    style={style}
  />
)

// Matches TaskRow's shape: emoji dot + a title line and a meta line.
export const TaskRowSkeleton = () => (
  <div className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-5 py-3">
    <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
    <div className="min-w-0 flex-1">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-2 h-3 w-1/4" />
    </div>
  </div>
)

export const TaskListSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div
    className="flex flex-col gap-1.5"
    role="status"
    aria-label="Loading tasks"
  >
    {Array.from({ length: rows }).map((_, i) => (
      <TaskRowSkeleton key={i} />
    ))}
  </div>
)
