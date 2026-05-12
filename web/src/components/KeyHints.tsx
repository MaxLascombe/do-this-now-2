export const KeyHints = ({
  items,
}: {
  items: ReadonlyArray<readonly [string, string]>
}) => (
  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
    {items.map(([k, label], i) => (
      <span
        key={i}
        className="inline-flex items-center gap-1.5 text-zinc-500"
      >
        <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-bold text-zinc-300">
          {k}
        </kbd>
        <span>{label}</span>
        {i < items.length - 1 && (
          <span className="ml-2 text-zinc-700">·</span>
        )}
      </span>
    ))}
  </div>
)
