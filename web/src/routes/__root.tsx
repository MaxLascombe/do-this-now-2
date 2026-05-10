import { ClerkProvider, Show, SignInButton } from '@clerk/tanstack-react-start'
import { ApiProvider } from '@dtn/shared/api-client'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { type ReactNode } from 'react'

import { webApiClient } from '../lib/api-client'
import { QueryProvider } from '../lib/query-client'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Do This Now' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
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
        <body className="bg-black text-white">
          <QueryProvider>
            <ApiProvider value={webApiClient}>
              <Show when="signed-in">{children}</Show>
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

