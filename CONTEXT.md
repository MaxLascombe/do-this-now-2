# Do This Now

A single-user-per-account task app centered on "what should I do right now." Tasks are ranked; the app surfaces the most urgent one and tracks time spent on it.

## Language

**Selected Task**:
The one task the user has committed to focusing on right now, stored authoritatively per user (a `selectedTaskId` pointer) and shared across all their devices. At most one exists at a time; it may be absent (nothing selected). Any task is selectable regardless of rank, due date, or snooze state. Selecting a task starts its timer (for a Child, its Keeper's timer). A Selected Task may have its timer running or paused. It unselects on the explicit "Return" action (Esc on desktop) or snoozing/deleting it; the explicit "Done" button instead flows selection straight to the next Top Task with its timer running (no next task → nothing selected). Pausing never unselects and never flows — even when pausing a fixed task at its target auto-completes it (which advances a repeating task in place); the sole exception is a one-off task whose completion deletes the row, which clears the pointer automatically.
_Avoid_: active task, current task, focused task, running task

**Focus View**:
The Home page when a task is Selected — shows that one task in full (emoji, title, timer, chips, tickable subtasks, actions). Replaces the former standalone task-detail page. When no task is Selected, Home instead shows the Top Tasks.
_Avoid_: detail page, task page

**Timer**:
Per-task elapsed-time tracker. At most one timer row runs at a time; it belongs to the Selected Task or, for a Child, its Keeper. Selecting a task starts its (resolved) timer and pauses any other running timer, banking that one's elapsed time — unless the newly selected task resolves to the same Keeper row already running, in which case the timer flows through uninterrupted. Paused vs running is independent of whether the task is selected; unselecting (Return) pauses and preserves the banked time so re-selecting resumes.
_Avoid_: stopwatch, clock

**Keeper / Child**:
A Child is a zero-timeframe task whose time is banked onto another task — its Keeper — so several Children can accrue into one Keeper's timer (e.g. Children "Finish book" under Keeper "Read"). Selecting a Child makes it the Selected Task while its Keeper's timer runs; selecting a sibling Child of the same Keeper moves selection without disturbing the running timer.
_Avoid_: timekeeper (the column name), parent, subtask (a Child is a full task, not a subtask)

**Top Tasks**:
The user's incomplete, non-snoozed tasks in ranked (priority) order, omitting tasks whose Surface gate hasn't opened yet (Once-it-counts tasks outside the horizon, Once-due tasks before their due date). When no task is Selected, the Home page shows the top three as a decision surface. Arriving without momentum, choosing is deliberate: tapping a row only focuses it; an explicit "Start" commits, selecting the task and starting its timer. Done and Snooze act on a row without committing to it. With momentum, commitment flows: an explicit Done in the Focus View hands selection to the next Top Task automatically (auto-flow).
_Avoid_: up next, the list

**Lock Screen Timer**:
The phone's always-visible face of the Selected Task (an iOS Live Activity on the lock screen and Dynamic Island). It exists exactly while a task is Selected — appearing, updating, and ending in step with selection and timer changes made on any device — and shows the Selected Task (a Child shows its own title over its Keeper's ticking timer) with elapsed time counting up beside the plan. Its single control pauses or resumes the Timer with the same meaning as in the app, including "pausing a fixed task at its target auto-completes it". While paused it stays visible, dimmed, so the Timer can be resumed without unlocking; switching the Selected Task updates it in place.
_Avoid_: widget (that's the in-app TimerWidget), notification, pill

**Counting**:
A task is Counting when its next due occurrence falls inside the target horizon window — the stretch of upcoming days the Daily Target averages over. Only Counting occurrences feed the Daily Target; a task due beyond the horizon contributes nothing to today's number.
_Avoid_: in range, active, relevant

**Surface**:
Per-task, three nested levels controlling when the task may appear in the Top Tasks: **Anytime** (the default), **Once it counts** (hidden until Counting), **Once due** (hidden until its due date arrives — calendar day only; a due-time never affects visibility). Each level's gate is strictly earlier than the next. Visibility is the whole story: a gated task stays in the all-tasks list (with a subtle marker), keeps normal rank rules once surfaced, still credits done minutes when completed, and remains selectable/startable from anywhere per the Selected Task rules. A completion that reschedules a repeating task past its gate removes it from the Top Tasks immediately.
_Avoid_: can do early (the retired boolean), blocked, locked, deferred, hidden task

**Platform Idiom**:
A native mechanic (system alert, bottom sheet, haptic, pull-to-refresh, swipe, native modal) used on mobile where web uses a styled in-page equivalent. Idioms are parity, not drift: the mechanic may differ, but the copy, colors, sizes, and content inside it must match the web design. Keyboard-only affordances are not idioms — they are omitted on touch entirely.
_Avoid_: inconsistency, deviation (when describing an idiom), mobile-only feature

**Done Minutes**:
Today's completion-credited work: each completed task credits its planned time or its actual time, whichever is larger. Only completions count — a running Timer contributes nothing to the Progress Bar, readouts, or projections until its task is done.
_Avoid_: elapsed, time worked, in-flight time

**Daily Target**:
The minutes of work the day asks for. It is the Progress Bar's max — displayed unchanged regardless of Lives — and the line at which the day is won. It is derived, never set directly: upcoming due work (overdue included) averaged over a rolling window (user-tunable, 14 days by default), capped so it never exceeds the Workday unless recurring load alone demands more.
_Avoid_: todo, goal, quota, lives target

**Workday**:
The user-set window of the day (08:30–24:00 by default) that pacing spreads the Daily Target across. Only pacing reads it — minutes done outside the Workday still count.
_Avoid_: business hours, working hours

**Won Day**:
A day whose done minutes plus Lives reached the Daily Target by day's end. A win banks the surplus as Lives and extends the Streak; anything short is a lost day.
_Avoid_: hit target, target met, completed day

**Streak**:
The count of consecutive Won Days. It shows yesterday's count until the moment today is won, then ticks up immediately; a lost day resets it to 0 — Lives are the only mercy mechanic.
_Avoid_: chain, run

**Progress Bar**:
The bar tracking today's minutes toward the Daily Target. Done minutes fill from the start; banked Lives extend the fill beyond them in a distinct color, so cushion is visible but never mistaken for work. A full bar (done + Lives) always means the day is won, and the bar is never shown full before then.
_Avoid_: streak bar

**Pacing Tick**:
The marker on the Progress Bar showing where done minutes alone should be by now, pacing linearly across the workday toward the Daily Target — never past it. Ahead/behind compares done minutes to the Pacing Tick; Lives never count as pace, so Lives-colored fill may sit beyond the tick while the label still reads behind.
_Avoid_: should-be marker, schedule marker

**Lives**:
Surplus minutes banked by finishing past a won day's Daily Target. They extend today's fill on the Progress Bar, shrinking the real work left to win today without changing the displayed Daily Target. The bank is deliberately uncapped: a bank exceeding the Daily Target wins the day outright — banked rest days are a feature. A lost day forfeits the entire bank and the day's done minutes carry nothing forward — a played bank does not survive a loss.
_Avoid_: hearts, cushion, credit

**Subtask**:
A step within a task. Seen and worked through in the Focus View — the Tasks list shows only a done/total count, never the subtasks themselves. There is no freeform notes field on a task; subtasks are the only sub-detail.
_Avoid_: step, checklist item, note
