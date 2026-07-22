import type { Task } from '../types'

// Minimal task factory for tests. Required defaults are realistic and
// boring; override any field via the partial.
export const makeTask = (over: Partial<Task> = {}): Task => ({
  id: over.id ?? 'task-test',
  userId: over.userId ?? 'user-test',
  title: over.title ?? 'A task',
  emoji: over.emoji ?? '📝',
  due: over.due ?? '2026-5-1',
  dueTime: over.dueTime ?? null,
  strictDeadline: over.strictDeadline ?? false,
  canDoEarly: over.canDoEarly ?? true,
  surface: over.surface ?? (over.canDoEarly === false ? 'due' : 'anytime'),
  repeat: over.repeat ?? 'No Repeat',
  repeatInterval: over.repeatInterval ?? 1,
  repeatUnit: over.repeatUnit ?? 'day',
  repeatWeekdays:
    over.repeatWeekdays ?? [false, false, false, false, false, false, false],
  timeFrame: over.timeFrame ?? 0,
  timekeeperId: over.timekeeperId ?? null,
  timeframeType: over.timeframeType ?? 'fixed',
  timerStartedAt: over.timerStartedAt ?? null,
  timerAccumulatedSeconds: over.timerAccumulatedSeconds ?? 0,
  measurementCount: over.measurementCount ?? 0,
  snooze: over.snooze ?? null,
  tags: over.tags ?? [],
  subtasks: over.subtasks ?? [],
  createdAt: over.createdAt ?? new Date('2026-01-01T00:00:00Z'),
  updatedAt: over.updatedAt ?? new Date('2026-01-01T00:00:00Z'),
})
