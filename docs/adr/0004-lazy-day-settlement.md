# Lazy day settlement on first read

Streak/Lives rollover used to be persisted only by `finalizeTodayProgress` on task completion, with GETs kept strictly side-effect-free (a deliberate fix — the previous design wrote on every refresh). But Lives are uncapped and a bank exceeding the Daily Target wins the day outright, so a rest day with zero completions is a legitimate Won Day — and under completion-only writes it was never recorded: the win, the streak, and the whole bank silently evaporated at midnight.

Decision: the first progress read of a new day settles any unsettled prior days before answering — walking them oldest-first, each absent day consuming a Daily Target's worth of bank until one comes up short (which wipes the rest and resets the Streak, per the loss rules). This deliberately re-admits a write on the GET path, but a narrow one: it only backfills verdicts for *past* days, at most once per day, idempotently; today's data is still never written on read.

## Considered Options

- **Midnight cron per user timezone** — most accurate verdicts, rejected for infra weight in a single-user-per-account app.
- **Snapshot the target on every completion + lazy settle** — drift-free for touched days, but adds a write per completion and doesn't help the zero-completion days that motivated the change.
- **Keep completion-only writes** — rejected because it contradicts uncapped Lives buying rest days.

## Consequences

- A settled-in-arrears day recomputes its Daily Target as-of-settlement-time; if tasks changed since that midnight, the verdict can drift slightly from what the bar showed live. Accepted.
- Multi-day absences settle as a chain, so a large bank drains one Daily Target per absent day until it wins no more.
