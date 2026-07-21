# Auto-flow after Done

The Top Tasks were designed around deliberate commitment: completing the Selected Task returned you to the list, and only an explicit Start committed to the next task (CONTEXT.md "Top Tasks"). Decided 2026-07-21 (feature-discovery grill): an explicit **Done in the Focus View now hands selection straight to the next Top Task and starts its timer** — no prompt, no return to the list. Back-to-back execution beats ceremony; the list remains the decision surface only when you arrive without momentum.

Boundaries that keep the rest of the model intact:

- Only the explicit Done chains. The pause-at-target auto-complete of a fixed task never does — pausing means stopping, and chaining would start a timer the user just tried to walk away from.
- Done/complete on a list row (Home top-three or Tasks page) never selects anything, same as today.
- Snooze, delete, and Return still exit to the list; Esc from the newly-flowed task works as always, so declining the flow is one keypress after the fact.

CONTEXT.md's Selected Task / Top Tasks entries get rewritten with the implementing change, not before.
