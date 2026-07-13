# Retire the task detail page in favour of the Focus View

## Status

accepted

## Context

The app had a standalone task page at `/tasks/$id`: a task's emoji, title, chips, timer, tickable subtasks, and every action on it (done, snooze, edit, delete, reschedule, duplicate, copy link). It was the place you "opened" a task from the Tasks list.

The one-task redesign then introduced the **Selected Task** — a single, authoritative, cross-device task the user has committed to — and the **Focus View**, the Home page rendering exactly that task in full. The two surfaces converged: the Focus View showed the same task, the same timer, the same actions. Every capability the detail page had either moved to the Focus View or was deleted outright as unwanted (reschedule, duplicate).

That left two ways to look at one task, disagreeing about what "current" meant. The detail page also had no notion of selection: opening a task there did not make it the Selected Task, so a user could sit on a task's page while a *different* task was the one actually selected and running.

## Decision

Delete the detail page. `/tasks/$id` is a redirect to `/tasks`; the Focus View is the only place a task is viewed and worked through. Committing to a task from the Tasks list ("Start") selects it and lands you in the Focus View.

Editing keeps its own route (`/tasks/$id/edit`), reached from the Focus View or a Tasks row.

## Considered options

- **Keep both, and make opening the detail page select the task.** Rejected: it makes "open" a committing action, which is exactly the surprise we removed elsewhere (a stray tap must not start a timer). It also leaves two near-identical screens to maintain and keep in sync.
- **Keep the detail page as a read-only inspect surface.** Rejected: inspection without committing is a real need, but a whole page is a heavy answer to it. The Tasks row already carries the task's metadata, and an inline subtask "peek" was built for this, tried, and rejected as clutter — the appetite for inspection is lower than it looked.

## Consequences

- One surface owns "a task in full", so there is no drift between two views of the same thing.
- The Tasks list is a decision surface, not a navigation hub: you Start a task (commit) or act on it in place (Done / Snooze / Edit / Delete). There is no "open".
- Old `/tasks/$id` links exist in the wild (the page had a Copy-link button), so the route 307s to `/tasks` rather than rendering a blank layout.
- There is deliberately **no way to inspect a task's subtasks from the Tasks list**. If that becomes painful, the answer is a peek affordance on the row — not resurrecting the page.
