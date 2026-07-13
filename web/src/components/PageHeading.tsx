import type { ReactNode } from 'react'

export const PageHeading = ({
  eyebrow,
  children,
  size = '2.5rem',
}: {
  eyebrow?: ReactNode
  children: ReactNode
  size?: string
}) => (
  <div>
    {eyebrow && (
      <div className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase">
        {eyebrow}
      </div>
    )}
    <h1
      id="main-content"
      tabIndex={-1}
      className="dtn-heading mt-1 text-zinc-50"
      style={{ fontSize: size, lineHeight: 1 }}
    >
      {children}
    </h1>
  </div>
)
