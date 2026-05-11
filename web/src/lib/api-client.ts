import { ApiError, type ApiClient } from '@dtn/shared/api-client'
import { getTzOffsetMin } from '@dtn/shared/time'

import * as actionFns from '../server/actions'
import * as progressFns from '../server/progress'
import * as taskFns from '../server/tasks'

const notFound = (id: string) =>
  new ApiError({
    code: 'not_found',
    status: 404,
    message: `Task ${id} not found`,
  })

export const webApiClient: ApiClient = {
  tasks: {
    list: () => taskFns.listTasks(),
    listTop: () =>
      taskFns.listTopTasks({ data: { tzOffsetMin: getTzOffsetMin() } }),
    get: async (id) => {
      const t = await taskFns.getTask({ data: { id } })
      if (!t) throw notFound(id)
      return t
    },
    create: (input) => taskFns.createTask({ data: input }),
    update: async (id, input) => {
      const t = await taskFns.updateTask({ data: { id, input } })
      if (!t) throw notFound(id)
      return t
    },
    delete: (id) => taskFns.deleteTask({ data: { id } }),
    complete: (id) => actionFns.completeTask({ data: { id } }),
    snooze: (id, allSubtasks = false) =>
      actionFns.snoozeTask({ data: { id, allSubtasks } }),
  },
  history: {
    forDate: (date) =>
      actionFns.getHistory({
        data: { date, tzOffsetMin: getTzOffsetMin() },
      }),
  },
  progress: {
    today: () =>
      progressFns.getProgressToday({
        data: { tzOffsetMin: getTzOffsetMin() },
      }),
  },
}
