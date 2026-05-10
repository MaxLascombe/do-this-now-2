import type {
  ApiClient,
  CompleteTaskResult,
  DeleteTaskResult,
  ProgressTodayResult,
  SnoozeTaskResult,
} from '@dtn/shared/api-client'
import type { HistoryEntry, Task } from '@dtn/shared/types'

import {
  completeTask,
  getHistoryForDate,
  snoozeTask,
} from '../server/actions'
import { getProgressToday } from '../server/progress'
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTask,
  getTopTasks,
  updateTask,
} from '../server/tasks'

// Server functions return values that include Date / unknown shapes;
// TanStack Start narrows them to SerializationError stand-ins in this repo's
// type setup. We cast at the boundary so the rest of the app sees the same
// shapes mobile produces over REST.
export const webApiClient: ApiClient = {
  listTasks: () => getAllTasks() as Promise<Task[]>,
  listTopTasks: () => getTopTasks() as Promise<Task[]>,
  getTask: (id) => getTask({ data: { id } }) as Promise<Task>,
  createTask: (input) => createTask({ data: input }) as Promise<Task>,
  updateTask: (id, input) =>
    updateTask({ data: { id, ...input } }) as Promise<Task>,
  deleteTask: (id) =>
    deleteTask({ data: { id } }) as Promise<DeleteTaskResult>,
  completeTask: (id) =>
    completeTask({ data: { id } }) as Promise<CompleteTaskResult>,
  snoozeTask: (id, allSubtasks = false) =>
    snoozeTask({ data: { id, allSubtasks } }) as Promise<SnoozeTaskResult>,
  getHistory: (date) =>
    getHistoryForDate({ data: { date } }) as Promise<HistoryEntry[]>,
  getProgressToday: () => getProgressToday() as Promise<ProgressTodayResult>,
}
