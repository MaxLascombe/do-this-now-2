import { clerkMiddleware } from '@clerk/tanstack-react-start/server'
import { createStart } from '@tanstack/react-start'

// Pass the key explicitly so Vite inlines it into the server bundle at build time; the middleware runs in plain Node where import.meta.env is undefined and Vercel scopes VITE_CLERK_PUBLISHABLE_KEY to production only, so preview requests have no env key to read.
export const startInstance = createStart(() => ({
  requestMiddleware: [
    clerkMiddleware({
      publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
    }),
  ],
}))
