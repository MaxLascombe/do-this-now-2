# Feature plan — 2026-07-21 grill session

Eleven features agreed in the feature-discovery grill. The common thread of every
acceptance: make the core loop **alive, robust, and immediate**. Explicitly
rejected lanes this session (do not revisit): natural-language quick capture /
⌘K palette, search, tag filters, iOS home-screen widget, week-ahead planning
view.

1. **Notifications** — the app reaches out: iOS push at a task's due-time,
   a streak-at-risk nudge in the evening (remaining-to-win vs hours left),
   and snooze-wake alerts. Per-trigger toggles in Settings. Rides the
   existing APNs plumbing.
2. **Day Recap** — first open of a new day shows what lazy settlement
   (ADR-0004) decided: days won/lost, Lives spent or banked, streak movement.
   One dismissible card; makes the midnight verdicts visible.
3. **Global Undo stack** — every action (done, snooze, delete, edit, timer
   ops, subtask ticks) pushes onto an undo history; z / ⌘Z pops, bounded to
   the last N actions. Replaces confirm-dialog ceremony with act-then-undo.
4. **Win Moment + milestones** — the instant done + Lives crosses the Daily
   Target the bar celebrates (fill surge, glow, haptic); streak milestones
   (7/30/100/365) get a distinct chip treatment. Respects reduced-motion.
5. **Live cross-device sync** — SSE/websocket event stream invalidates the
   query caches so a phone completion updates the web bar within a second;
   polling stays as fallback.
6. **Full-auto Next-up** (ADR-0005) — Done in the Focus View flows straight
   into the next Top Task's Focus View, timer running. Pause-at-target
   auto-complete never chains; row-level Done never selects.
7. **Offline-capable mobile** — mutations queue locally and replay on
   reconnect (last-write-wins); cached tasks/progress render immediately
   with a subtle offline marker.
8. **Focus Pulse** — a haptic + visual beat when the running timer crosses
   the planned time (fixed: when Done unlocks; fluid: passing the usual
   time), mirrored on the Lock Screen Timer. No sound by default.
9. **Runaway-timer Guard** — past ~3× planned time or a long idle/lock the
   timer flags itself; on return you confirm or trim the overrun before it
   poisons credit and fluid estimates. Mirrored on the Lock Screen Timer.
10. **Morning Brief push** — one push at Workday start: today's target,
    banked Lives, and the top task. The outbound twin of the Day Recap.
11. **Usually-takes insight** — Focus View chip on **fixed tasks only**,
    shown when actuals diverge >20% from planned ("usually 52m · planned
    30m"). Fluid tasks are excluded by construction — their planned time IS
    the running average.
