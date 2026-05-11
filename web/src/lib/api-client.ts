import type { ApiClient } from '@dtn/shared/api-client'
import { getTzOffsetMin } from '@dtn/shared/time'

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

export const webApiClient: ApiClient = {
  listTasks: () => getAllTasks(),
  listTopTasks: () =>
    getTopTasks({ data: { tzOffsetMin: getTzOffsetMin() } }),
  getTask: async (id) => {
    const t = await getTask({ data: { id } })
    if (!t) throw new Error(`Task ${id} not found`)
    return t
  },
  createTask: (input) => createTask({ data: input }),
  updateTask: async (id, input) => {
    const t = await updateTask({ data: { id, ...input } })
    if (!t) throw new Error(`Task ${id} not found`)
    return t
  },
  deleteTask: (id) => deleteTask({ data: { id } }),
  completeTask: (id) => completeTask({ data: { id } }),
  snoozeTask: (id, allSubtasks = false) =>
    snoozeTask({ data: { id, allSubtasks } }),
  getHistory: (date) =>
    getHistoryForDate({
      data: { date, tzOffsetMin: getTzOffsetMin() },
    }),
  getProgressToday: () =>
    getProgressToday({ data: { tzOffsetMin: getTzOffsetMin() } }),
}
