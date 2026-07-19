# 6. Local-first Live Activity mirroring

Date: 2026-07-19

## Status

Accepted

## Context

ADR-0004 made the Lock Screen Timer push-driven: every mutation triggers a
server sync that mirrors state to all devices via APNs. That is the only
possible path for cross-device changes (web → phone), but it also meant
actions taken **in the app on the phone itself** waited a full
server → Neon → APNs round-trip (1–3 s, sometimes worse) before the lock
screen reacted — visibly laggy next to the app's own optimistic UI.

Every action that can change the lock screen (select, timer start/pause/
adjust, edits, done/snooze/delete) already lands in the TanStack Query cache
optimistically before the network call resolves.

## Decision

The app watches its own query cache (selection + selected task + resolved
Keeper) and mirrors the derived `ContentState` straight onto the Live
Activity via ActivityKit — start, update in place, or end — the moment the
cache changes. The server push pipeline is unchanged and remains the
authority: its updates land on the same activity (identical content, no
alert) and correct any drift.

One race needed closing: a locally-started activity and the server's
push-to-start would duplicate, because the server can't yet see the local
activity's update token. So the app sends its lock-screen device token as
`X-Lockscreen-Device` on every API call **once it knows the running build
can mirror locally**; the sync treats that device as already having an
activity (feeding it into the existing `shouldSendStart` gate) and skips
only the push-to-start — updates and ends still flow.

## Consequences

- Lock-screen reaction to in-app actions is instant, including offline
  (timer mutations are offlineFirst; ActivityKit needs no network).
- Cross-device actions still arrive via push, unchanged.
- Old app builds never send the header (the JS feature-detects
  `syncActivity`), so they keep the pure push-driven behavior.
- If a local start ever fails transiently, the next cache change retries it;
  a web-originated action (no header) still push-to-starts the phone.
