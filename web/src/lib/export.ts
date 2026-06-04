import { taskToInput } from '@dtn/shared/task-input'
import type { Task } from '@dtn/shared/types'

// Serialize tasks to import-compatible JSON: each task is reduced to its
// TaskInput shape (no ids, timer state, or timestamps) via taskToInput, so the
// downloaded file can be fed straight back through the JSON import.
export function tasksToExportJson(tasks: Task[]): string {
  return JSON.stringify(tasks.map(taskToInput), null, 2)
}
