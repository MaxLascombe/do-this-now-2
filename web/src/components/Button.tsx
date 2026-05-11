// Intentionally platform-specific: this is the web (DOM <button>) variant.
// Mobile's counterpart lives at mobile/components/Button.tsx and renders a
// react-native Pressable — different render target, can't be shared.
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { type ComponentProps } from 'react'
import { twMerge as tw } from 'tailwind-merge'

export const Button = ({
  icon,
  text,
  loading = false,
  className,
  ...props
}: {
  icon: ComponentProps<typeof FontAwesomeIcon>['icon']
  text?: string
  loading?: boolean
} & Omit<ComponentProps<'button'>, 'children'>) => (
  <button
    {...props}
    className={tw(
      'flex items-center gap-1 rounded-full border border-black px-2.5 py-2 text-sm font-bold text-white outline-none ring-white ring-offset-0 ring-offset-black hover:border-gray-700 hover:bg-gray-900 focus:z-10 focus:ring disabled:opacity-50 disabled:hover:border-gray-800 disabled:hover:bg-black',
      className,
    )}
  >
    {!!text && text}
    {(!text || !loading) && (
      <FontAwesomeIcon icon={icon} className="block h-4 w-4" />
    )}
    {loading && (
      <FontAwesomeIcon
        icon={faSpinner}
        className="block h-4 w-4 animate-spin"
      />
    )}
  </button>
)
