import { Fragment } from 'react'

import { splitOnLinks } from '../lib/linkify'

// Renders task notes with bare http(s) URLs turned into clickable links.
// The parent <p> keeps whitespace-pre-wrap so newlines are preserved.
export function LinkifiedNotes({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  return (
    <p className={className}>
      {splitOnLinks(text).map((seg, i) =>
        seg.href ? (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-zinc-600 underline-offset-2 hover:text-zinc-100"
          >
            {seg.text}
          </a>
        ) : (
          <Fragment key={i}>{seg.text}</Fragment>
        ),
      )}
    </p>
  )
}
