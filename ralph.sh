#!/bin/bash

# Ralph loop dev cycle for do-this-now-2.
#
# Interactive (default): opens a claude session with PROMPT.md pre-loaded.
# Autonomous (--auto):   runs claude -p in a loop, committing after each iteration.
#
# Usage:
#   ./ralph.sh                      # interactive session
#   ./ralph.sh --auto               # autonomous loop (max 20 iterations, $5 budget)
#   ./ralph.sh --auto --max 5       # autonomous loop, 5 iterations max
#   ./ralph.sh --auto --budget 2    # autonomous loop, $2 budget cap

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Defaults
AUTO=false
MAX_ITERATIONS=20
BUDGET_USD=5
COMPLETION_SIGNAL="ALL_TASKS_COMPLETE"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --auto)       AUTO=true; shift ;;
    --max)        MAX_ITERATIONS="$2"; shift 2 ;;
    --budget)     BUDGET_USD="$2"; shift 2 ;;
    -h|--help)
      grep '^#' "$0" | head -12 | sed 's/^# //'
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

if [[ ! -f PROMPT.md ]]; then
  echo "Error: PROMPT.md not found in $SCRIPT_DIR" >&2
  exit 1
fi

PROMPT="$(cat PROMPT.md)"

if [[ "$AUTO" == false ]]; then
  # Interactive: open claude with the prompt pre-loaded as the first message.
  exec claude "$PROMPT"
fi

# Autonomous loop
echo "🔄 Ralph loop starting (max $MAX_ITERATIONS iterations, \$$BUDGET_USD budget)"
echo "   Completion signal: $COMPLETION_SIGNAL"
echo ""

# Snapshot blocker count before the loop so we can detect new ones each iteration
blockers_before() {
  grep -c '^## \[' BLOCKERS.md 2>/dev/null || echo 0
}

ITERATION=1
BLOCKERS_AT_START=$(blockers_before)

while [[ $ITERATION -le $MAX_ITERATIONS ]]; do
  echo "══════════════════════════════════════════"
  echo "  Ralph iteration $ITERATION / $MAX_ITERATIONS"
  echo "══════════════════════════════════════════"

  TMPFILE=$(mktemp)
  claude --print \
    --permission-mode bypassPermissions \
    --max-budget-usd "$BUDGET_USD" \
    "$PROMPT" 2>&1 | tee "$TMPFILE"
  OUTPUT=$(cat "$TMPFILE")
  rm -f "$TMPFILE"
  echo ""

  # Commit any changes made this iteration
  if ! git diff --quiet || ! git diff --staged --quiet; then
    git add -A
    git commit -m "chore: ralph iteration $ITERATION" 2>/dev/null || true
    git push 2>/dev/null || true
    echo "✔ Committed and pushed changes for iteration $ITERATION"
  else
    echo "  (no changes to commit)"
  fi

  # Warn if new blockers were written this iteration
  BLOCKERS_NOW=$(blockers_before)
  NEW_BLOCKERS=$(( BLOCKERS_NOW - BLOCKERS_AT_START ))
  if [[ $NEW_BLOCKERS -gt 0 ]]; then
    echo ""
    echo "⚠️  $NEW_BLOCKERS new blocker(s) written to BLOCKERS.md — your input is needed:"
    echo ""
    grep -A2 '^## \[' BLOCKERS.md | tail -n $(( NEW_BLOCKERS * 3 ))
    echo ""
    BLOCKERS_AT_START=$BLOCKERS_NOW
  fi

  # Check completion signal
  if echo "$OUTPUT" | grep -qF "$COMPLETION_SIGNAL"; then
    echo ""
    echo "✅ Detected completion signal after $ITERATION iteration(s). Stopping."
    if [[ $(blockers_before) -gt 0 ]]; then
      echo ""
      echo "⚠️  There are open blockers in BLOCKERS.md. Resolve them and re-run."
    fi
    exit 0
  fi

  ITERATION=$((ITERATION + 1))
done

echo ""
echo "🛑 Reached max iterations ($MAX_ITERATIONS). Stopping."
if [[ $(blockers_before) -gt 0 ]]; then
  echo ""
  echo "⚠️  There are open blockers in BLOCKERS.md. Resolve them and re-run."
fi
