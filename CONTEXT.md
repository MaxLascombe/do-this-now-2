# Do This Now

A single-user-per-account task app centered on "what should I do right now." Tasks are ranked; the app surfaces the most urgent one and tracks time spent on it.

## Language

**Selected Task**:
The one task the user has committed to focusing on right now, stored authoritatively per user (a `selectedTaskId` pointer) and shared across all their devices. At most one exists at a time; it may be absent (nothing selected). Any task is selectable regardless of rank, due date, or snooze state. Selecting a task starts its timer (for a Child, its Keeper's timer). A Selected Task may have its timer running or paused. It unselects only on the explicit "Return" action (Esc on desktop), the explicit "Done" button, or snoozing/deleting it. Pausing never unselects — even when pausing a fixed task at its target auto-completes it (which advances a repeating task in place); the sole exception is a one-off task whose completion deletes the row, which clears the pointer automatically.
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
The user's incomplete, non-snoozed tasks in ranked (priority) order, omitting tasks that Can't Do Early while their due date is still ahead. When no task is Selected, the Home page shows the top three as a decision surface. Choosing one is deliberate: tapping a row only focuses it; an explicit "Start" commits, selecting the task and starting its timer. Done and Snooze act on a row without committing to it.
_Avoid_: up next, the list

**Can Do Early**:
Per-task property, on by default, saying the task may be worked ahead of its due date. When off, the task is a candidate only from its due date on: the Top Tasks omit it entirely while its due date is after the user's local today (calendar day only — a due-time never affects visibility), and a completion that reschedules a repeating task past today removes it from that surface immediately. Visibility is the whole story: the task stays in the all-tasks list (with a subtle marker), keeps normal rank rules once due, still counts toward progress targets, and remains selectable/startable from anywhere per the Selected Task rules.
_Avoid_: blocked, locked, deferred, hidden task

**Subtask**:
A step within a task. Seen and worked through in the Focus View — the Tasks list shows only a done/total count, never the subtasks themselves. There is no freeform notes field on a task; subtasks are the only sub-detail.
_Avoid_: step, checklist item, note
