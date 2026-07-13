import { ClerkProvider, Show, SignIn } from '@clerk/tanstack-react-start'
import { ApiProvider } from '@dtn/shared/api-client'
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

import { ConfirmProvider } from '../components/ConfirmProvider'
import { ShortcutsHelp } from '../components/ShortcutsHelp'
import { ToastProvider } from '../components/ToastProvider'
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
      {
        name: 'description',
        content:
          'A focus-first to-do app that surfaces the single thing to do next — and gets out of your way.',
      },
      { name: 'theme-color', content: '#0a0a0a' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      {
        name: 'apple-mobile-web-app-status-bar-style',
        content: 'black-translucent',
      },
      { name: 'apple-mobile-web-app-title', content: 'Do This Now' },
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
                  <ToastProvider>
                    <ShortcutsHelp />
                    {children}
                  </ToastProvider>
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
    <div className="flex min-h-screen w-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <span aria-hidden="true" className="text-xl" style={{ color: '#34d399' }}>
          ✦
        </span>
        <div className="font-mono text-[10px] tracking-[0.4em] text-zinc-500 uppercase">
          Do This Now
        </div>
        <h1
          className="dtn-task-title text-zinc-50"
          style={{ fontSize: '3rem', lineHeight: 1.05 }}
        >
          One task.
          <br />
          Right now.
        </h1>
        <p className="max-w-xs font-mono text-sm leading-relaxed text-zinc-400">
          A focus-first to-do app that surfaces the single thing to do next —
          and gets out of your way.
        </p>
      </div>
      <SignIn
        routing="hash"
        appearance={{
          variables: {
            colorPrimary: '#34d399',
            colorBackground: '#0d0d0e',
            colorText: '#fafafa',
            colorTextSecondary: '#a1a1aa',
            colorInputBackground: '#18181b',
            colorInputText: '#fafafa',
            colorDanger: '#fb7185',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            borderRadius: '0.75rem',
          },
          elements: {
            rootBox: 'mx-auto',
            card: 'border border-zinc-800 shadow-2xl shadow-black/40',
          },
        }}
      />
    </div>
  )
}
