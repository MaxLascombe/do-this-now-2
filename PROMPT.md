# Agent Prompt

Read `CURRENT_STATE.md` to understand the current architecture and what already exists. Read `TASKS.md` for the list of pending tasks. Read `BLOCKERS.md` to see what is currently blocked.

If `TASKS.md` has no remaining unblocked tasks, output exactly `ALL_TASKS_COMPLETE` and stop.

Otherwise:

1. Pick the single most important **unblocked** task based on dependencies and priority (tasks have no inherent order; skip any marked `[BLOCKED]`).
2. Complete it fully — write the code, wire it up, make it work.
3. Remove it from `TASKS.md`.
4. Update `CURRENT_STATE.md` to reflect what was built (describe current state of the code, not a checklist).
5. Run `git add -A && git commit -m "<one-line commit message describing the change>"`.

Do not ask for confirmation. Do not ask clarifying questions. Make reasonable decisions and proceed. One task per run.

---

## Blocker workflow

If at any point you cannot complete the chosen task without information or action from the user (e.g. missing credentials, an ambiguous requirement you cannot resolve, a decision that is outside your authority):

1. **Mark the task blocked** in `TASKS.md` by changing `- ` to `- [BLOCKED] ` at the start of that line.
2. **Append a blocker entry to `BLOCKERS.md`** in this format:

```
## [YYYY-MM-DD] <task name>
**Needs:** <one or two sentences describing exactly what the user must provide or decide>
```

3. **Do not partially commit broken code.** If you made changes trying to complete the task, either finish them enough to be safe to commit, or revert them.
4. **Move on** — pick the next unblocked task and continue. If no unblocked tasks remain, output `ALL_TASKS_COMPLETE`.
