import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { tasks, userState } from '@dtn/shared/schema'

import { db } from '../../../db'
import { unselect } from '../actions'
import { getSelection } from '../selection'
import { applyTimerAction } from '../timer'

// Integration tests against a real Neon Postgres. Skipped in CI (no
// DATABASE_URL). Namespaced to a dedicated test user, cleaned up each run.

const TEST_USER = 'user_vitest_selection'

async function cleanup() {
  await db.delete(userState).where(eq(userState.userId, TEST_USER))
  await db.delete(tasks).where(eq(tasks.userId, TEST_USER))
}

async function makeTask(over: Partial<typeof tasks.$inferInsert> = {}) {
  const [row] = await db
    .insert(tasks)
    .values({
      userId: TEST_USER,
      title: over.title ?? 'Selection test task',
      emoji: '✅',
      due: '2026-5-12',
      timeFrame: over.timeFrame ?? 30,
      ...over,
    })
    .returning()
  return row
}

describe.skipIf(!process.env.DATABASE_URL)('selection (integration)', () => {
  beforeEach(cleanup)
  afterAll(cleanup)

  it('is empty when nothing has been selected', async () => {
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: null })
  })

  it('starting a timer selects that task', async () => {
    const task = await makeTask()
    await applyTimerAction(TEST_USER, task.id, { kind: 'start' })
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: task.id })
  })

  it('selects the child the user acted on, not its keeper', async () => {
    const keeper = await makeTask({ title: 'Read', timeFrame: 30 })
    const child = await makeTask({
      title: 'Finish book',
      timeFrame: 0,
      timekeeperId: keeper.id,
    })
    await applyTimerAction(TEST_USER, child.id, { kind: 'start' })
    // Selection is the picked child…
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: child.id })
    // …while the timer runs on the keeper row.
    const [keeperRow] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, keeper.id))
    expect(keeperRow.timerStartedAt).not.toBeNull()
  })

  it('moves the pointer when a different task is selected', async () => {
    const a = await makeTask({ title: 'A' })
    const b = await makeTask({ title: 'B' })
    await applyTimerAction(TEST_USER, a.id, { kind: 'start' })
    await applyTimerAction(TEST_USER, b.id, { kind: 'start' })
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: b.id })
  })

  it('unselect pauses the running timer and clears the pointer', async () => {
    const task = await makeTask()
    await applyTimerAction(TEST_USER, task.id, { kind: 'start' })
    const result = await unselect(TEST_USER)
    expect(result).toEqual({ selectedTaskId: null })
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: null })
    const [row] = await db.select().from(tasks).where(eq(tasks.id, task.id))
    expect(row.timerStartedAt).toBeNull()
  })

  it('unselect is a no-op when nothing is selected', async () => {
    expect(await unselect(TEST_USER)).toEqual({ selectedTaskId: null })
  })

  it('keeps pointer and timer consistent across a Return then a new select', async () => {
    const x = await makeTask({ title: 'X' })
    const y = await makeTask({ title: 'Y' })
    await applyTimerAction(TEST_USER, x.id, { kind: 'start' })
    await unselect(TEST_USER)
    await applyTimerAction(TEST_USER, y.id, { kind: 'start' })
    // Invariant the atomic unselect protects: the pointer names exactly the
    // task whose timer is running, never a stale/null mismatch.
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: y.id })
    const [xr] = await db.select().from(tasks).where(eq(tasks.id, x.id))
    const [yr] = await db.select().from(tasks).where(eq(tasks.id, y.id))
    expect(xr.timerStartedAt).toBeNull()
    expect(yr.timerStartedAt).not.toBeNull()
  })

  it('deleting the selected task clears the pointer (ON DELETE SET NULL)', async () => {
    const task = await makeTask()
    await applyTimerAction(TEST_USER, task.id, { kind: 'start' })
    await db.delete(tasks).where(eq(tasks.id, task.id))
    expect(await getSelection(TEST_USER)).toEqual({ selectedTaskId: null })
  })
})
