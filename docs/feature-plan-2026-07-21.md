# Feature plan — 2026-07-21 grill session

Ten features agreed in the feature-discovery grill, spec'd in the follow-up
pre-build grill. The common thread of every acceptance: make the core loop
**alive, robust, and immediate**. Explicitly rejected lanes (do not revisit):
natural-language quick capture / ⌘K palette, search, tag filters, iOS
home-screen widget, week-ahead planning view, and the fixed-task
"usually-takes" drift chip (cut on reflection — fluid tasks make it redundant
by construction and the fixed-drift case wasn't worth a chip).

Cross-cutting spec decisions: all notifications are iOS-only and scheduled
**on-device** (local notifications re-planned on every sync / silent-push
wake — no server cron); undo stacks are per-device, in-memory,
session-scoped.

1. **Notifications** — the app reaches out, all scheduled on-device:
   a push at a task's due-time (tasks with a due-time only), a snooze-wake
   alert when a snoozed task returns, and a **pace-based** streak-at-risk
   nudge — fired at the projected moment remaining-to-win becomes
   uncoverable at your recent pace (pace formula is an implementation
   tunable). Per-trigger toggles in Settings.
2. **Day Recap** — first open of a new day shows what lazy settlement
   (ADR-0004) decided: days won/lost, Lives spent or banked, streak
   movement. Lost days get equal weight with honest rose accents ("bank 3h
   wiped, streak 12 → 0") — no softening. One dismissible card per day.
3. **Global Undo stack** — everything undoable EXCEPT timer start/pause
   (pressing again is the undo, and un-pausing would falsify elapsed time):
   done, snooze, unsnooze, delete, edits, subtask ticks, timer add/reset.
   z / ⌘Z on web, toast button on mobile; 20 actions deep, session-scoped.
   Replaces confirm-dialog ceremony with act-then-undo.
4. **Win Moment + milestones** — the instant done + Lives crosses the Daily
   Target: **full celebration** — confetti burst over the bar, glow, haptic
   pattern, once a day; milestone days (7/30/100/365) stack a banner on
   top. Reduced-motion users get a restrained surge instead.
5. **Live cross-device sync** — event stream invalidates the query caches
   so a phone completion updates the web bar within a second; polling stays
   as fallback.
6. **Full-auto Next-up** (ADR-0005) — Done in the Focus View flows straight
   into the next Top Task's Focus View, timer running. Pause-at-target
   auto-complete never chains; row-level Done never selects; no next task
   → back to the list.
7. **Offline-capable mobile** — mutations queue locally and replay on
   reconnect (last-write-wins); cached tasks/progress render immediately.
   Queue visibility: offline marker **plus pending count**.
8. **Focus Pulse** — a single haptic + visual beat when the running timer
   crosses the planned time (fixed: when Done unlocks; fluid: passing the
   usual time), mirrored on the Lock Screen Timer. One beat, never nags,
   no sound.
9. **Runaway-timer Guard** — **flag and notify, never auto-pause**: at
   ~3× planned (or crossing midnight) the timer is marked runaway and a
   local notification asks "still working?"; on return, a reconcile prompt
   offers keep / trim to planned / custom before the credit lands.
10. **Morning Brief push** — one push at Workday start, **always sent**:
    today's target, banked Lives, top task — and on a pre-won day it says
    so ("Rest day earned: bank 9h ≥ target 8h").

## Build order & cadence

Agreed order (smallest-to-heaviest, dependency-respecting): Win Moment →
Focus Pulse → Day Recap → Next-up → Undo → Notifications → Morning Brief →
Runaway Guard → Live Sync → Offline. Cadence: all ten built and PR'd as a
batch off main, review happens once the batch is up.
