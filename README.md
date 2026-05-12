# Do This Now

A task manager that tells you what to work on now. Web app + iOS/Android
companion, sharing a single backend.

## Stack

| Layer    | Choice                                                                  |
| -------- | ----------------------------------------------------------------------- |
| Web      | TanStack Start (React + Vite + Nitro), deployed on Vercel               |
| Mobile   | Expo (React Native + expo-router + NativeWind), iOS via TestFlight      |
| Database | PostgreSQL (Neon serverless WebSocket), Drizzle ORM                     |
| Auth     | Clerk (web: `@clerk/tanstack-react-start`, mobile: `@clerk/clerk-expo`) |
| Styling  | Tailwind v4 (web) / NativeWind v4 (mobile)                              |
| AI       | Anthropic Claude (Haiku) — emoji suggestions per task                   |

## Repo layout

```
.
├── web/        TanStack Start app (cookie-auth server fns + REST API for mobile)
├── mobile/     Expo app (Bearer-token API client)
├── shared/     @dtn/shared — types, Zod schemas, Drizzle schema, helpers,
│               api-client interface, React Query hooks
└── .github/    CI workflow (typecheck + tests + vite build verification)
```

`web` and `mobile` both consume `@dtn/shared/queries` for React Query hooks.
The hooks call into an `ApiClient` provided by each platform:
- web wraps TanStack Start server functions (RPC).
- mobile wraps REST endpoints under `/api/...` exposed by web, authed with a
  Clerk Bearer token + `X-Tz-Offset` header.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the three-layer pattern
(lib → server-fn → REST → ApiClient → hook) and how to add a new endpoint.

## Common commands

```bash
pnpm install                  # install all workspaces (+ git hooks)

# Development
pnpm dev                      # web + mobile in parallel (concurrently)
pnpm web:dev                  # web only
pnpm mobile:start             # mobile only (Expo)

# Quality
pnpm typecheck                # tsc --noEmit across shared, web, mobile
pnpm test                     # vitest in shared + web

# Database (Drizzle, against the live Neon DB pointed at by DATABASE_URL)
pnpm db:studio                # GUI for inspecting prod rows
pnpm db:generate              # generate a migration after schema change
pnpm db:check                 # verify schema vs migrations match
```

## Workflow

`main` is protected — no direct pushes. All changes go through PRs:

1. `git checkout -b <branch>` → push → open PR
2. CI (`typecheck + test + build`) must pass.
3. Resolve any PR conversations.
4. Squash-merge.

Pre-push hook (lefthook) runs the same typecheck + test locally so most
failures surface before reaching CI. Bypass with `--no-verify` for WIP.

## Deploy

Web auto-deploys to Vercel on push to `main` via the root `vercel.json`. The
build runs `vite build`; production deploys additionally run
`drizzle-kit migrate` first (gated by `VERCEL_ENV=production` so preview
deploys never touch the DB).

Mobile is built with EAS (`mobile/eas.json`) for TestFlight / internal
distribution.

## Environment

`.env.example` lists the required variables. At minimum:
- `DATABASE_URL` (Neon Postgres connection string)
- Clerk publishable + secret keys
- `ANTHROPIC_API_KEY` (Claude API — needed for `/api/tasks/suggest-emojis`)
- `EXPO_PUBLIC_API_URL` (where the mobile client points)
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`

<!-- smoke-test: trigger claude review (will revert) -->
