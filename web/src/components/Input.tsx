import { forwardRef } from 'react'
import { twMerge as tw } from 'tailwind-merge'
import type { ComponentProps } from 'react'

export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        {...props}
        className={tw(
          'block w-96 min-w-0 flex-1 rounded border border-gray-800 bg-black p-2.5 text-white placeholder-gray-400 outline-none ring-white ring-offset-0 ring-offset-black hover:bg-gray-900 focus:border-gray-700 focus:bg-gray-900 focus:ring sm:text-sm',
          className,
        )}
      />
    )
  },
)
