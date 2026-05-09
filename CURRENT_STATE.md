# Do-This-Now 2.0 — Current State

This file describes the current architecture and what exists in the codebase. It is updated when work is completed; completed work is documented here as part of the system description, not as a task list.

---

## Stack

| Layer    | Choice                                                            |
| -------- | ----------------------------------------------------------------- |
| App      | TanStack Start (React + Vite + Nitro server), Railway             |
| Database | PostgreSQL (Railway plugin), Drizzle ORM + `postgres` driver      |
| Auth     | Clerk (planned: `@clerk/tanstack-react-start`)                    |
| Styling  | Tailwind CSS 4                                                    |

Single Railway service hosts both the React frontend (SSR via Nitro) and the
server-side data layer. There is no separate Express backend.

---

## Repository Layout

```
/
  src/
    routes/          ← TanStack Router file-based routes
      __root.tsx     ← root layout, Header, devtools
      index.tsx
      demo/          ← scaffolded TanStack demos (delete when no longer useful)
    components/
      Header.tsx
    db/
      index.ts       ← drizzle client (postgres-js), reads DATABASE_URL from env
      schema.ts      ← tasks + history tables, repeat enums, exported types
    lib/
      task-sorting.ts ← sortTasks, isSnoozed, nextDueDate, newSafeDate, dateString
    router.tsx, styles.css, …
  drizzle.config.ts  ← schema path + DATABASE_URL credentials
  railway.json       ← Nixpacks build, `pnpm db:push && pnpm start` on deploy
  vite.config.ts     ← @tanstack/react-start, nitro, tailwind, react plugins
  package.json       ← pnpm@9.15.9, Node 22.x, drizzle/postgres deps
  .env.example       ← DATABASE_URL, CLERK_SECRET_KEY
```

---

## What Exists

**App shell**

- TanStack Start app built with Vite + Nitro. Router under `src/`: `router.tsx`
  creates the router; `routes/__root.tsx` is the root layout with a shared
  `Header` and TanStack devtools.
- Routes: root layout, index route, scaffolded demo routes under `routes/demo/`.
  No app-specific routes yet.
- Tailwind CSS 4 via `@tailwindcss/vite`. Global styles in `src/styles.css`.

**Database**

- Drizzle ORM with `postgres` driver. Client initialized in `src/db/index.ts`
  from `DATABASE_URL` (injected by Railway from the linked Postgres plugin).
- Schema in `src/db/schema.ts`: `tasks` and `history` tables.
  - `tasks`: title, due, strictDeadline, repeat / repeatInterval / repeatUnit /
    repeatWeekdays, timeFrame, snooze, subtasks (jsonb), userId, timestamps.
  - `history`: snapshot of completed task as jsonb, taskId, completedAt.
  - Two pg enums: `repeat_option`, `repeat_unit`.
  - Exported types: `Task`, `NewTask`, `HistoryEntry`, `NewHistoryEntry`.
- No committed migration files. Schema is synced on every Railway deploy via
  `drizzle-kit push --force`.

**Sorting logic**

- `src/lib/task-sorting.ts`: `sortTasks(tasks, today)` (mutates array in-place),
  `isSnoozed`, `nextDueDate`, `newSafeDate`, `dateString`. Priority order:
  not-snoozed > due today/past-due > strict deadline > won't repeat tomorrow >
  won't repeat today > earlier due date > shorter time frame.

**Deployment**

- Railway project: `fortunate-gentleness`. One service `do-this-now-2` (TanStack
  Start app) plus the `Postgres` plugin. `DATABASE_URL` reference variable
  injected automatically.
- `railway.json` pins Nixpacks builder; build runs
  `pnpm install --frozen-lockfile && pnpm build`; start runs
  `pnpm db:push && pnpm start` so schema syncs before each boot.
- Public domain assigned to the service.

**Tooling**

- ESLint and Prettier at repo root. `old-version/` submodule ignored by both.
- Vitest installed for tests.
- pnpm 9.15.9 pinned via `packageManager`. Node 22.x via `engines`.

---

## Not Yet in Place

- No auth (Clerk not yet installed). All routes/data are unauthenticated.
- No task domain server functions or UI yet, though schema and sorting logic
  are ready.
- No `dotenv` import in `src/db/index.ts` — local dev needs `DATABASE_URL` set
  via the shell or a `.env` file the runtime already loads.

---

## Notes

- Dev: `pnpm dev` (port 3000) runs the full app — frontend and server.
- macOS dev may need `ulimit -n 10000` for file descriptor limits.
- Task sorting reference (old app): not snoozed > due today/past due > strict
  deadline > won't repeat tomorrow > won't repeat today > earlier due date >
  shorter time frame.
