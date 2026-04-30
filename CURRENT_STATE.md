# Do-This-Now 2.0 — Current State

This file describes the current architecture and what exists in the codebase. It is updated when work is completed; completed work is documented here as part of the system description, not as a task list.

---

## Stack

| Layer     | Choice                                      |
| --------- | ------------------------------------------- |
| Frontend  | TanStack Start (React + Vite), Vercel       |
| Backend   | Express 5, Railway                          |
| Database  | PostgreSQL (Railway), Drizzle ORM + postgres driver |
| Auth      | Clerk (`@clerk/express` on server, `@clerk/react` on client) |
| Styling   | Tailwind CSS 4                              |

---

## Repository Layout

```
/                    ← frontend (TanStack Start, Vercel)
  src/
  package.json
server/              ← Express API (Railway)
  src/
    index.ts         ← app entry, Express setup, /health route
    db/
      index.ts       ← drizzle client (postgres driver)
      schema.ts      ← placeholder, no tables yet
    routes/          ← empty, routes added per task
  drizzle.config.ts
  package.json
  tsconfig.json
  .env.example       ← DATABASE_URL, CLERK_SECRET_KEY, PORT
```

---

## What Exists

**Frontend shell**

- TanStack Start app built with Vite. Entry and routing under `src/`: `router.tsx` creates the router; `routes/__root.tsx` is the root layout with a shared `Header` and TanStack devtools.
- Routes: root layout, index route, demo routes under `routes/demo/`. No app-specific routes yet.
- Tailwind CSS 4.0 via `@tailwindcss/vite`. Global styles in `src/styles.css`.

**Backend shell (`server/`)**

- Express 5 server. `src/index.ts` sets up CORS, JSON body parsing, and a `GET /health` route.
- Drizzle ORM with `postgres` driver. Client initialized in `src/db/index.ts` from `DATABASE_URL`.
- Schema defined in `src/db/schema.ts`: `tasks` and `history` tables with Drizzle pg-core. `tasks` has all fields from old-version (title, due, strictDeadline, repeat/repeatInterval/repeatUnit/repeatWeekdays, timeFrame, snooze, subtasks as jsonb, userId for Clerk, timestamps). `history` stores a snapshot of the completed task as jsonb plus a reference `taskId` and `completedAt`. Two pg enums: `repeat_option` and `repeat_unit`. TypeScript types exported: `Task`, `NewTask`, `HistoryEntry`, `NewHistoryEntry`.
- Scripts: `pnpm dev` (tsx watch), `pnpm build` (tsc), `pnpm db:generate`, `pnpm db:migrate`.
- Deploy target: Railway (deploy from `server/` subdirectory).

**Tooling**

- ESLint and Prettier configured at repo root. `old-version/` submodule ignored by both.
- Vitest installed for frontend tests.

---

## Not Yet in Place

- No Drizzle migrations yet (schema defined but `db:generate` not run against a live DB).
- No auth (Clerk not yet installed on either side).
- No task domain: no data model, API routes, or UI for tasks, history, or "do this now" behavior.
- No deployment (neither Railway nor Vercel connected yet).

---

## Notes

- Dev: run `pnpm dev` (frontend, port 3000) and `cd server && pnpm dev` (backend, port 4000) in parallel.
- Dev server on macOS may require `ulimit -n 10000` if you hit file descriptor limits.
- Task sorting reference (old app): not snoozed > due today/past due > strict deadline > won't repeat tomorrow > won't repeat today > earlier due date > shorter time frame.
