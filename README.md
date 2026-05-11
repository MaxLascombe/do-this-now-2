# Do This Now

A task manager that tells you what to work on now. Web app + iOS/Android
companion, sharing a single backend.

## Stack

| Layer    | Choice                                                                |
| -------- | --------------------------------------------------------------------- |
| Web      | TanStack Start (React + Vite + Nitro), deployed on Vercel             |
| Mobile   | Expo (React Native + expo-router + NativeWind), iOS via TestFlight    |
| Database | PostgreSQL (Neon serverless), Drizzle ORM + `@neondatabase/serverless` |
| Auth     | Clerk (web: `@clerk/tanstack-react-start`, mobile: `@clerk/clerk-expo`) |
| Styling  | Tailwind v4 (web) / NativeWind v4 (mobile)                            |

## Repo layout

```
.
├── web/        TanStack Start app (cookie-auth server fns + REST API for mobile)
├── mobile/     Expo app (Bearer-token API client)
├── shared/     @dtn/shared — types, Zod schemas, Drizzle schema, helpers,
│               api-client interface, React Query hooks
├── scripts/    one-time data migration utilities (DynamoDB → Postgres)
└── drizzle/    migrations (per workspace; see web/drizzle/)
```

`web` and `mobile` both consume `@dtn/shared/queries` for React Query hooks.
The hooks call into an `ApiClient` provided by each platform:
- web wraps TanStack Start server functions
- mobile wraps REST endpoints under `/api/...` exposed by web, authed with a
  Clerk Bearer token

## Common commands

```bash
pnpm install                          # install all workspaces

pnpm web:dev                          # web dev server (vite, port 3000)
pnpm web:build                        # web prod build (runs drizzle-kit migrate)

pnpm mobile:start                     # expo dev server, scan QR with Expo Go
pnpm mobile:ios                       # start on iOS simulator

pnpm --filter web db:generate         # after schema change → new migration
pnpm --filter web db:migrate          # apply pending migrations
pnpm --filter web db:push             # ad-hoc push schema (dev only)

pnpm --filter web test                # vitest
pnpm --filter web check               # prettier + eslint --fix
```

## Deploy

Web auto-deploys to Vercel on push to `main` via the root `vercel.json`. The
build command runs `pnpm --filter web build`, which runs `drizzle-kit migrate`
against the Neon DB before building the SSR bundle. The Build Output API
artifacts are moved from `web/.vercel/output` to `.vercel/output` at the
project root so Vercel picks them up.

Mobile is built with EAS (`mobile/eas.json`) for TestFlight / internal
distribution.

## Environment

`.env.example` lists the required variables. At minimum:
- `DATABASE_URL` (Neon Postgres)
- Clerk publishable + secret keys
- `EXPO_PUBLIC_API_URL` (where the mobile client points)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
