# Keyboard hints: one-home rule, help modal as a derived reference

Each keyboard shortcut's ambient hint appears in exactly one place — a `<kbd>`
chip on its own control, or the bottom `KeyHints` strip for keyless shortcuts
(cursor moves, page navigation) — never both. Controls that are self-evident
but have no clean chip spot (the timer's play/pause, the sort toggle, the
history date arrows) get no ambient hint at all; their keys live only in the
`?` help. That help modal is the exhaustive reference — exempt from the rule —
and is **rendered from a central shortcut registry (`web/src/lib/shortcuts.ts`)
that the routes also bind from**, so what's bound and what's documented cannot
drift. This is what makes the removals safe: pulling a hint off the screen
never orphans a shortcut, because the registry-driven help always lists it.

We chose the one-home rule over hints-only-on-buttons so that genuinely keyless
shortcuts stay discoverable, and registry-derived help over a hand-maintained
list because the hand-maintained one had already drifted (it was missing the
timer shortcut) and is now the sole home for the un-hinted keys. Casing lives in
the registry too: bare letter keys are lowercase; named/modifier/symbol keys
(`Esc ⌫ ↵ ↑↓ ← → + / ? ⇧S`) keep their conventional form.

The trade-off: adding or changing a shortcut now means editing the registry (a
route can't silently bind a key the help won't show), and self-evident controls
depend on `?` for keyboard discoverability.
