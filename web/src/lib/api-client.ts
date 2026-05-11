import type { ApiClient } from '@dtn/shared/api-client'
import { getTzOffsetMin } from '@dtn/shared/time'

import * as actionFns from '../server/actions'
import * as progressFns from '../server/progress'
import * as taskFns from '../server/tasks'

export const webApiClient: ApiClient = {
  listTasks: () => taskFns.listTasks(),
  listTopTasks: () =>
    taskFns.listTopTasks({ data: { tzOffsetMin: getTzOffsetMin() } }),
  getTask: async (id) => {
    const t = await taskFns.getTask({ data: { id } })
    if (!t) throw new Error(`Task ${id} not found`)
    return t
  },
  createTask: (input) => taskFns.createTask({ data: input }),
  updateTask: async (id, input) => {
    const t = await taskFns.updateTask({ data: { id, ...input } })
    if (!t) throw new Error(`Task ${id} not found`)
    return t
  },
  deleteTask: (id) => taskFns.deleteTask({ data: { id } }),
  completeTask: (id) => actionFns.completeTask({ data: { id } }),
  snoozeTask: (id, allSubtasks = false) =>
    actionFns.snoozeTask({ data: { id, allSubtasks } }),
  getHistory: (date) =>
    actionFns.getHistory({
      data: { date, tzOffsetMin: getTzOffsetMin() },
    }),
  getProgressToday: () =>
    progressFns.getProgressToday({ data: { tzOffsetMin: getTzOffsetMin() } }),
}
