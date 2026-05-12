# Architecture

Quick orientation for adding features without bypassing the established patterns.

## The 5-layer request flow

Every read or mutation goes through the same chain on both web and mobile:

```
        UI component
            │ calls
            ▼
   shared/src/queries.ts          (1) React Query hook
            │ calls api.tasks.foo()
            ▼
    ApiClient (platform-specific)  (2) thin adapter
       ├─ web:    web/src/lib/api-client.ts  → server-fn (RPC)
       └─ mobile: mobile/lib/api-client.tsx  → fetch /api/...
            │
            ▼
   web/src/server/{tasks,actions,...}.ts    (3) server-fn (web RPC entry)
            │ also exposed at
   web/src/routes/api/...                    (4) REST handler (mobile entry)
            │  both call into
            ▼
   web/src/server/lib/{tasks,actions,...}.ts (5) pure business logic + DB
            │  uses
            ▼
       Drizzle ORM → Neon Postgres
```

Adding a new operation means a touch at each layer:

1. `shared/src/queries.ts` — `useFoo` hook calling `api.foo.bar()`.
2. `shared/src/api-client.ts` — add `bar` to the `ApiClient` interface.
3. `web/src/lib/api-client.ts` and `mobile/lib/api-client.tsx` — implement `bar`.
4. `web/src/server/tasks.ts` (or new file) — server-fn that delegates to the lib.
5. `web/src/routes/api/foo/bar.ts` — REST route that delegates to the same lib.
6. `web/src/server/lib/tasks.ts` — the actual function that hits Drizzle.

## Server-fn input validation

All server-fns use the same helper:

```ts
import { validate, v } from './lib/validate'

export const completeTask = createServerFn({ method: 'POST' })
  .inputValidator(validate(z.object({ id: v.id, tzOffsetMin: v.tzOffsetMin })))
  .handler(async ({ data }) => actionsLib.completeTask(await requireUserId(), data.id, data.tzOffsetMin))
```

- `v.id` / `v.tzOffsetMin` / `v.ymd` are the reusable atomic schemas.
- Compose with `z.object({ ... })` for the full input.

## REST error envelope

REST handlers in `web/src/routes/api/...` use the helpers from
`web/src/server/lib/http.ts`:

- `withAuth(handler)` — wraps the handler and provides `userId`; returns 401 if not signed in.
- `getTzFromRequest(request)` — reads `X-Tz-Offset` header.
- `unauthenticated()` / `notFound(msg?)` / `invalid(details)` — uniform `{code, message?, details?}` 4xx responses.

Mobile's API client converts non-2xx responses into a typed `ApiError`
(in `@dtn/shared/api-client`) so consumers can branch on `err.code`.

## Data model

| Table            | Purpose                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `tasks`          | Live tasks. Indexed by `user_id`.                                                                                                      |
| `history`        | Append-only log of completions. `task_id` FK on `tasks` with `ON DELETE SET NULL` so history survives task deletion via `taskSnapshot`. |
| `task_events`    | `'snoozed' \| 'deleted'` events that the live `tasks` row doesn't preserve. Used for the Stats page (snooze count, abandonment rate).   |
| `daily_progress` | One row per (user, day) recording streak + lives. Written by `finalizeTodayProgress` on completion, NOT on every GET.                  |

## Transactions

`web/src/db/index.ts` uses `drizzle-orm/neon-serverless` (WebSocket transport).
The HTTP variant `neon-http` does NOT support `db.transaction()` and will throw
"No transactions support in neon-http driver" — don't switch back without
also refactoring `completeTask` + `snoozeTask` + `deleteTask` to drop their
transactions. (See PR #4 — silently broke prod for weeks before the swap.)

## Optimistic updates

`shared/src/queries.ts` exports `useCompleteTask`, `useSnoozeTask`, `useDeleteTask`.
They use task-specific optimistic helpers that respect the server's actual
behavior:

- `optimisticComplete`:
    - Whole-task (≤1 undone subtask): remove from list + bump `progressToday.done`.
    - Subtask-advance: flip the next subtask to `done` in cache, no progress bump.
- `optimisticSnooze`:
    - Whole-task (`allSubtasks` or no actionable subtasks): remove from list.
    - Subtask-only: snapshot for rollback, don't mutate cache, let refetch handle it.

Both helpers consult pure predicates in `@dtn/shared/task-sorting`
(`willCompletingFinishTheTask`, `willSnoozingRemoveTask`) — unit tested
without a DB.

## Stats

`web/src/server/lib/stats.ts` is read-only. It loads all `history`,
`task_events`, `daily_progress`, and `tasks` for the user in parallel,
then aggregates in JS. Returns the full `StatsResult` payload (heatmap,
streak, top tasks, emoji freq, etc.) — see `shared/src/types.ts`.

The heatmap uses percentile-based shading (`p33` / `p66` of non-zero
days) so the gradient has real variation regardless of the user's
output range.

## Testing

| Type              | Where                                                | Runs in CI? |
| ----------------- | ---------------------------------------------------- | ----------- |
| Unit (pure)       | `shared/src/__tests__/`                              | yes         |
| Integration (DB)  | `web/src/server/lib/__tests__/actions.test.ts`       | no (skips when DATABASE_URL absent) |

Integration tests use a dedicated `user_vitest_integration` namespace and
clean up before/after — safe to co-exist with prod data on the same DB.
