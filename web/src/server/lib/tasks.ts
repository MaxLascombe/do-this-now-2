import { and, eq } from 'drizzle-orm'

import { getUserLocalNow, getUserToday } from '@dtn/shared/helpers'
import { taskEvents, tasks } from '@dtn/shared/schema'
import { showsInTopTasks, sortTasks } from '@dtn/shared/task-sorting'
import { ceilTaskTime } from '@dtn/shared/timer-utils'
import { db } from '../../db'
import { syncLockScreenSoon } from './lockscreen'
import type { TaskInput } from '@dtn/shared/task-input'
import type { Task } from '@dtn/shared/schema'

export {
  repeatOptionSchema,
  repeatUnitSchema,
  repeatWeekdaysSchema,
  subTaskSchema,
  taskInputSchema,
  type TaskInput,
} from '@dtn/shared/task-input'

// Two keeper-rules are enforced app-side (they need a DB read so can't be
// CHECK constraints): the keeper must itself be a fixed, non-zero-time
// task. Throws a friendly Error with a 400-shaped message that the REST
// route surfaces verbatim.
async function assertKeeperEligible(
  userId: string,
  keeperId: string,
  conn: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
): Promise<void> {
  const keeper = (
    await conn
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, keeperId)))
      .limit(1)
  ).at(0)
  if (!keeper) {
    throw new Error('Timekeeper not found')
  }
  if (keeper.timeframeType !== 'fixed') {
    throw new Error('Timekeeper must be a fixed-type task')
  }
  if (!(keeper.timeFrame > 0)) {
    throw new Error('Timekeeper must have a non-zero time frame')
  }
}

// Count children (tasks pointing at `id` as their timekeeper). Used by
// updateTask + deleteTask to refuse incompatible changes with a clear
// message before Postgres' FK RESTRICT bites us.
async function countChildren(
  userId: string,
  id: string,
  conn: typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0] = db,
): Promise<number> {
  const rows = await conn
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.timekeeperId, id)))
  return rows.length
}

export async function listTasks(userId: string): Promise<Array<Task>> {
  const rows = await db.select().from(tasks).where(eq(tasks.userId, userId))
  return rows.map(ceilTaskTime)
}

export async function listTopTasks(
  userId: string,
  tzOffsetMin: number,
): Promise<Array<Task>> {
  const all = await listTasks(userId)
  const { todayDate } = getUserToday(tzOffsetMin)
  const visible = all.filter((t) => showsInTopTasks(t, todayDate))
  sortTasks(visible, todayDate, getUserLocalNow(tzOffsetMin))
  return visible
}

export async function getTask(
  userId: string,
  id: string,
): Promise<Task | null> {
  const rows = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
    .limit(1)
  return rows[0] ? ceilTaskTime(rows[0]) : null
}

export async function createTask(
  userId: string,
  input: TaskInput,
): Promise<Task> {
  return db.transaction(async (tx) => {
    if (input.timekeeperId) {
      await assertKeeperEligible(userId, input.timekeeperId, tx)
    }
    const [row] = await tx
      .insert(tasks)
      .values({ ...input, userId })
      .returning()
    return ceilTaskTime(row)
  })
}

export async function updateTask(
  userId: string,
  id: string,
  input: TaskInput,
): Promise<Task | null> {
  const result = await db.transaction(async (tx) => {
    if (input.timekeeperId) {
      // Self-reference is also blocked by the CHECK constraint, but check
      // here too for a friendlier error.
      if (input.timekeeperId === id) {
        throw new Error('A task cannot be its own timekeeper')
      }
      await assertKeeperEligible(userId, input.timekeeperId, tx)
    }
    // If this task is itself a keeper (has children), block transitions
    // that would invalidate the keeper rules: can't go fluid, can't go
    // zero-time. Force the user to detach children first.
    const childCount = await countChildren(userId, id, tx)
    if (childCount > 0) {
      if (input.timeframeType !== 'fixed') {
        throw new Error(
          `${childCount} task${childCount === 1 ? '' : 's'} track time under this one — detach them before switching to fluid.`,
        )
      }
      if (input.timeFrame === 0) {
        throw new Error(
          `${childCount} task${childCount === 1 ? '' : 's'} track time under this one — detach them before removing the time frame.`,
        )
      }
    }
    const row = (
      await tx
        .update(tasks)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
        .returning()
    ).at(0)
    return row ? ceilTaskTime(row) : null
  })
  // Edits to the Selected Task's title/emoji/target refresh its
  // lock-screen face. Lib-level so both entry points fire it.
  syncLockScreenSoon(userId)
  return result
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  // Record the 'deleted' event BEFORE the actual DELETE — the FK on
  // task_events.task_id sets to NULL on cascade, so the event row
  // survives, but inserting before keeps the link populated while the
  // task exists. Also surface a friendly error when the DB's FK RESTRICT
  // would block the delete (this task is a keeper for other tasks).
  await db.transaction(async (tx) => {
    const childCount = await countChildren(userId, id, tx)
    if (childCount > 0) {
      throw new Error(
        `Can't delete: ${childCount} task${childCount === 1 ? '' : 's'} track time under this one. Detach them first.`,
      )
    }
    await tx.insert(taskEvents).values({ userId, taskId: id, kind: 'deleted' })
    await tx
      .delete(tasks)
      .where(and(eq(tasks.userId, userId), eq(tasks.id, id)))
  })
  // Deleting the Selected Task clears the pointer via the FK with no app
  // code running — this hook is the only thing that ends its activity.
  syncLockScreenSoon(userId)
}
