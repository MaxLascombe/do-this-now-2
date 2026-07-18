# Mobile parity doctrine: native mechanics, web looks

## Status

accepted

## Context

The mobile app drifted visually and behaviorally from the web app, which is where the product's look is designed (small-screen web is the reference rendering). A full parity audit (2026-07-18, ~56 discrepancies) forced the question: what does "parity" mean for a React Native app mirroring a web app?

## Decision

- **Web's small-screen rendering is the source of truth for looks and language**: colors, sizes, spacing, typography, wording, content, empty states, loading skeletons, and section structure must match the web page at phone width.
- **Native platform mechanics are parity, not drift**: `Alert.alert` dialogs, bottom sheets for pickers, haptics, pull-to-refresh, swipe gestures, native modal presentation, and the toast lifted above the tab bar are the mobile way of expressing the same design. Their *copy and visual content* must still match web's.
- **Keyboard-only visuals do not port**: the keyboard cursor ring, kbd hint chips, and shortcut affordances are meaningless on touch and are omitted, not replicated. Placeholder/copy that references keys ("press Enter") is adapted, not copied.
- **Improvements flow both ways**: when the audit finds mobile did something better, web adopts it rather than mobile regressing (this round: the 99%-cap progress bar, the richer ✺ empty-state card, the delete-Undo toast, the save-button spinner, a responsive-width heatmap).

## Considered options

- **Strict pixel-and-mechanism parity** (rebuild web's styled dialogs and inline controls in RN). Rejected: fights the platform, more code, worse feel, no user benefit.
- **Loose "same features" parity** (each platform styles itself). Rejected: that is how the drift happened — the phone app "looked all wrong" next to the web app.

## Consequences

- Future mobile work must pull values (sizes, copy, colors) from the web source rather than inventing near matches; reviewers should treat a nudged px value or reworded string as a defect.
- Some web changes now exist purely to honor "improvements flow both ways" — their origin is the mobile app.
- Where a web value physically misfits a phone (e.g. fixed chart widths), the shared design is made responsive on BOTH platforms instead of forking.
- **Type-scale exception (2026-07-18)**: web's px font sizes read too small on a phone, so mobile deliberately renders type one step larger (9–15px sizes bump +1, row titles 18, page headings 36). Layout, spacing, color, and wording still follow web exactly; only the type scale diverges.
