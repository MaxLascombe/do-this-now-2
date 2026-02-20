# Do-This-Now 2.0 — Current State

This file describes the current architecture and what exists in the codebase. It is updated when work is completed; completed work is documented here as part of the system description, not as a task list.

---

## Stack

| Layer     | Choice                    |
| --------- | ------------------------- |
| Framework | TanStack Start            |
| Database  | Neon (not yet connected)  |
| ORM       | Drizzle                   |
| Auth      | Clerk (not yet added)     |
| Styling   | Tailwind CSS              |
| Hosting   | Vercel (not yet deployed) |

---

## What Exists

**Application shell**

- TanStack Start app built with Vite. Entry and routing live under `src/`: `router.tsx` creates the router from the generated route tree; `routes/__root.tsx` is the root layout and mounts a shared `Header` plus TanStack devtools.
- Routes: root layout, index route, and demo routes under `routes/demo/` (SSR variants, server functions, etc.). No app-specific routes yet (no home task view, task list, or history).

**Styles and assets**

- Tailwind CSS 4.0 via `@tailwindcss/vite`. Global styles in `src/styles.css`.

**Data layer (dependencies only)**

- Drizzle ORM and Neon serverless driver are installed: `drizzle-orm`, `@neondatabase/serverless`, and `dotenv` (runtime); `drizzle-kit` and `tsx` (dev) for schema and migrations. No schema, config, or database connection yet.

**Tooling and quality**

- ESLint and Prettier are configured at the repo root (`eslint.config.js`, `prettier.config.js`). The `old-version/` submodule is ignored by both. Scripts: `pnpm build`, `pnpm dev` (port 3000), `pnpm lint`, `pnpm format`, `pnpm check` (format + lint fix). Vitest is installed for tests.

**Reference implementation**

- The original app lives in `old-version/` as a Git submodule (React + Vite, AWS Amplify, DynamoDB, Tailwind). Use it for behavior and UX reference (e.g. task shape, sorting, keyboard shortcuts).

---

## Not Yet in Place

- No deployment (repo not connected to Vercel, no deployed URL).
- No database or schema (no Drizzle config, no migrations, no Neon connection).
- No auth (no Clerk).
- No task domain: no data model, API, or UI for tasks, history, or “do this now” behavior.

---

## Notes

- Dev server on macOS may require `ulimit -n 10000` if you hit file descriptor limits.
- Task sorting in the old app (for reference): not snoozed > due today/past due > strict deadline > won’t repeat tomorrow > won’t repeat today > earlier due date > shorter time frame.
