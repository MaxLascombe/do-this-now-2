# Push-driven Lock Screen Timer with device-token auth

## Status

accepted

## Context

The Selected Task should be visible and controllable from the iPhone lock screen: see the ticking timer, pause and resume it, without unlocking into the app. iOS's mechanism for this is a Live Activity (ActivityKit) with interactive buttons (App Intents, iOS 17+). Three forces shape the design:

- ADR-0001 chose **polling** over push for cross-device selection sync. A lock-screen widget cannot poll — the only way state changes reach it while the app is closed is an APNs push (`liveactivity` push type), including *starting* the activity when a task is selected on another device (push-to-start).
- The "pause at target auto-completes" rule (see Selected Task in CONTEXT.md) currently lives in the **client** (`shared/src/queries.ts`): the server's timer endpoint only banks time, and the app issues the follow-up complete call. A lock-screen button hitting the raw endpoint would silently skip completion.
- Clerk session JWTs live ~60s and the widget extension cannot run Clerk's refresh flow, so the widget cannot authenticate the way the app does.

## Decision

- **Cross-device lifecycle via APNs.** The web server sends push-to-start / update / end pushes directly to APNs (HTTP/2 + .p8 auth key) whenever a server mutation changes the Selected Task or its timer. In-app sync stays on ADR-0001 polling; push is added only for the surface that cannot poll. A new table registers each device's push-to-start token and each live activity's update token.
- **A dedicated lock-screen endpoint carrying full app semantics.** The widget's Pause/Resume calls a new endpoint that resolves the Selected Task, applies the timer action, and runs `shouldCompleteOnPause` + completion in one transaction — moving that rule server-side for this path so the glossary meaning of "pause" holds on every surface.
- **Server-issued device tokens for widget auth.** The app requests a long-lived revocable secret (hashed at rest, per device), stores it in the Keychain App Group; the widget authenticates with it against the lock-screen endpoints and push-token registration. Clerk remains the auth system for everything else.

## Considered options

- **Phone-managed lifecycle (no APNs).** The app starts/ends the activity locally; selections made on desktop reach the phone only on next app open. Rejected: the primary use case is selecting on desktop and glancing at the phone — a lock screen that's usually stale defeats it.
- **Deep-link buttons instead of extension networking.** Every tap unlocks the phone and opens the app. Rejected: a weaker version of the stated goal ("easily start and stop").
- **Clerk-token juggling in the widget.** Mint session tokens from Swift via Clerk's frontend API using the stored client token. Rejected: re-implements Clerk's refresh flow against semi-documented APIs; fragile.
- **Plain pause from the lock screen (no auto-complete).** Rejected: a fixed task paused at target from the lock screen would never complete — the app's `wasRunning` guard means the later in-app re-pause is a no-op.
- **`expo-widgets` (official, JS-defined widget UI).** Rejected for now: requires Expo SDK 55+ (app is on 54), and its button events wake the JS app in the background rather than calling the network from the extension — slower taps and a different auth story. Revisit when the SDK upgrade happens anyway; the server side of this design is unaffected.

## Consequences

- The server gains push infrastructure (APNs key in env, token registry, fire-and-forget send after commit — a push failure never rolls back a mutation) and a second, narrow auth surface (device tokens) beside Clerk.
- Every mutation that changes selection or timer state must fire a push hook; `deleteTask` needs an explicit end-push because the FK (`ON DELETE SET NULL`) clears the Selected pointer with no app code running.
- Live Activities cap at ~8h of updates / 12h on the lock screen; a long-idle paused activity goes stale until the app is next opened. Accepted as an iOS platform limit.
- Requires a native EAS build (widget extension ⇒ new runtimeVersion); this feature cannot ship over OTA.
