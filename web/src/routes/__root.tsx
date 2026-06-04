import { ClerkProvider, Show, SignInButton } from '@clerk/tanstack-react-start'
import { ApiProvider } from '@dtn/shared/api-client'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { CommandPalette } from '../components/CommandPalette'
import { ConfirmProvider } from '../components/ConfirmProvider'
import { ShortcutsHelp } from '../components/ShortcutsHelp'
import { webApiClient } from '../lib/api-client'
import { QueryProvider } from '../lib/query-client'

import appCss from '../styles.css?url'
import { useEffect, useState, type ReactNode } from 'react'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Do This Now' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body className="text-zinc-50">
          <QueryProvider>
            <ApiProvider value={webApiClient}>
              <RouteAnnouncer />
              <Show when="signed-in">
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-zinc-50 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-900"
                >
                  Skip to content
                </a>
                <ConfirmProvider>
                  <CommandPalette />
                  <ShortcutsHelp />
                  {children}
                </ConfirmProvider>
              </Show>
              <Show when="signed-out">
                <SignedOutScreen />
              </Show>
            </ApiProvider>
          </QueryProvider>
          <Scripts />
        </body>
      </html>
    </ClerkProvider>
  )
}

// Mirror <title> changes into a polite live region so screen readers hear SPA navigations.
function RouteAnnouncer() {
  const [message, setMessage] = useState('')
  useEffect(() => {
    const title = document.querySelector('title')
    if (!title) return
    const observer = new MutationObserver(() => setMessage(document.title))
    observer.observe(title, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    return () => observer.disconnect()
  }, [])
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  )
}

function SignedOutScreen() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Do This Now</h1>
      <SignInButton mode="modal">
        <button className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium hover:border-gray-500 hover:bg-gray-800">
          Sign in
        </button>
      </SignInButton>
    </div>
  )
}
