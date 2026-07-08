# Authoritative Selected-Task pointer, synced by polling

## Status

accepted

## Context

The app is moving to a "one Selected Task at a time" model: a single task the user has committed to, shared across all their devices, and the only task whose timer may run. Previously there was no stored notion of "the current task" — the UI inferred the running task by scanning whatever task list a page happened to have cached for a `timerStartedAt != null` row. That inference is why single-timer enforcement, though correct in the database, appeared broken in production: a device kept showing a stale running timer because the pausing mutation never wrote the paused task back to cache and background polling stalls on backgrounded tabs (and the 5-min `staleTime` suppresses the refocus refetch).

## Decision

Selection is stored as an authoritative per-user pointer in a new singleton table `user_state { userId PK, selectedTaskId uuid null FK→tasks ON DELETE SET NULL, updatedAt }`, and propagated across devices by **polling** (the existing TanStack Query mechanism), not real-time push. The selection query polls even in the background and bypasses `staleTime` on focus, so any device converges on the current selection within ~3s.

## Considered options

- **A flag column on `tasks`** (e.g. `selectedAt`, "selected = newest non-null"). Rejected: "only one selected per user" isn't enforceable by a simple constraint and relies on app code nulling the previous row on every select — the exact fragile pattern that already made single-timer enforcement look broken. It also muddies the tasks table.
- **Real-time push (SSE / WebSocket).** Rejected: genuine new server infrastructure, and long-lived connections are awkward on the Vercel serverless deploy target. Selection needs "reliably consistent within a few seconds," not sub-second — polling suffices.

## Consequences

- Deleting the Selected Task clears the pointer at the database level (`ON DELETE SET NULL`), so the "delete unselects" rule is race-proof and needs no app code.
- The pointer names the task the user picked; for a Child task the running timer resolves to its Keeper's row, so `selectedTaskId` and the timer-bearing row can differ.
- `user_state` is the natural home for future per-user state (preferences, etc.).
- The single-row upsert gives a serialization point to close the concurrent-double-start hole (two near-simultaneous starts under READ COMMITTED both seeing "no other running timer").
