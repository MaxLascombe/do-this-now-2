import type { KeyAction } from '../hooks/useKeyAction'

// Single source of truth for keyboard shortcuts: the key, the symbol shown in
// the ? help, the label, and the casing. Routes bind their slice with local
// handlers via `bind`; ShortcutsHelp renders HELP_GROUPS off this same list.
// Deriving both from one place is what stops the help modal from drifting out
// of sync (which is how it had gone stale and dropped the timer shortcut).
//
// Casing rule lives here: bare letter keys are lowercase; named / modifier /
// symbol keys keep their conventional form (Esc ⌫ ↵ ↑↓ ← → + / ? ⇧S).
export type Shortcut = {
  // Keycode name for useKeyAction. Absent on display-only rows (↑↓, 1–3, ?).
  key?: string
  // Symbol rendered in the ? help (and available to chips that want to match).
  display: string
  label: string
  shift?: boolean
  // Space collides with activating a focused button, so its binding is ignored
  // while an interactive element has focus (see useKeyAction).
  guardInteractive?: boolean
}

export const SHORTCUTS = {
  // Navigate — bound per route, excluding the current page.
  now: { key: 'n', display: 'n', label: 'Now' },
  tasks: { key: 't', display: 't', label: 'Tasks' },
  newTask: { key: '=', shift: true, display: '+', label: 'New task' },
  history: { key: 'h', display: 'h', label: 'History' },
  stats: { key: 'a', display: 'a', label: 'Stats' },

  // Focus View — act on the Selected Task.
  done: { key: 'd', display: 'd', label: 'Done' },
  snooze: { key: 's', shift: false, display: 's', label: 'Snooze' },
  snoozeSubtasks: {
    key: 's',
    shift: true,
    display: '⇧S',
    label: 'Snooze subtasks',
  },
  edit: { key: 'e', display: 'e', label: 'Edit' },
  timer: { key: 'space', guardInteractive: true, display: 'Space', label: 'Timer' },
  timerAlt: { key: 'p', display: 'p', label: 'Timer' },
  delete: { key: 'backspace', display: '⌫', label: 'Delete' },
  return: { key: 'escape', display: 'Esc', label: 'Return' },

  // Top Tasks / Tasks list — a keyboard cursor over the rows.
  start: { key: 'enter', display: '↵', label: 'Start' },
  select: { key: 'enter', display: '↵', label: 'Select' },
  snoozeRest: { key: 'r', display: 'r', label: 'Snooze rest' },
  wake: { key: 'w', display: 'w', label: 'Wake' },
  sort: { key: 'o', display: 'o', label: 'Sort' },
  search: { key: '/', display: '/', label: 'Search' },
  home: { key: 'escape', display: 'Esc', label: 'Home' },
  moveUp: { key: 'up', display: '↑', label: 'Move up' },
  moveDown: { key: 'down', display: '↓', label: 'Move down' },

  // History.
  prevDay: { key: 'left', display: '←', label: 'Previous day' },
  nextDay: { key: 'right', display: '→', label: 'Next day' },

  // Anywhere — handled directly in ShortcutsHelp, listed here for the modal.
  help: { display: '?', label: 'Keyboard shortcuts' },
} satisfies Record<string, Shortcut>

// Display-only rows: the ↑↓ and 1–3 pairs read better merged in the help than
// as separate bound keys (the individual keys are bound inline in the routes).
const MOVE: Shortcut = { display: '↑↓', label: 'Move' }
const PICK: Shortcut = { display: '1–3', label: 'Pick a task' }

// Pair a registry shortcut with a route-local handler. Key/shift/guard come
// from the registry, so a bound shortcut can't disagree with what ? shows.
export const bind = (sc: Shortcut, action: KeyAction['action']): KeyAction => {
  if (!sc.key) throw new Error(`Shortcut "${sc.label}" has no bindable key`)
  return {
    key: sc.key,
    description: sc.label,
    action,
    ...(sc.shift !== undefined ? { shift: sc.shift } : {}),
    ...(sc.guardInteractive ? { guardInteractive: true } : {}),
  }
}

// The ? modal renders exactly this — complete by construction. The Now screen
// is split by state because its shortcuts differ (a task selected vs choosing).
const S = SHORTCUTS
export const HELP_GROUPS: ReadonlyArray<{
  title: string
  items: ReadonlyArray<Shortcut>
}> = [
  { title: 'Navigate', items: [S.now, S.tasks, S.newTask, S.history, S.stats] },
  {
    title: 'Now — a task is selected',
    // Timer lists both keys: Space is primary, p the fallback for when a
    // focused button would swallow Space (see guardInteractive).
    items: [S.done, S.snooze, S.snoozeSubtasks, S.edit, S.timer, S.timerAlt, S.delete, S.return],
  },
  {
    title: 'Now — choosing a task',
    items: [S.start, S.snooze, S.snoozeRest, S.done, S.edit, S.delete, MOVE, PICK],
  },
  {
    title: 'Tasks list',
    items: [S.select, S.done, S.snooze, S.wake, S.edit, S.delete, MOVE, S.sort, S.search, S.home],
  },
  { title: 'History', items: [S.prevDay, S.nextDay, S.home] },
  { title: 'Stats', items: [S.home] },
  { title: 'Anywhere', items: [S.help] },
]
