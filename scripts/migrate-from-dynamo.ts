import 'dotenv/config'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { neon } from '@neondatabase/serverless'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/neon-http'

import { history, tasks } from '../src/db/schema'

const userId = process.env.MIGRATION_USER_ID
if (!userId) throw new Error('MIGRATION_USER_ID must be set')

const region = process.env.AWS_REGION ?? 'us-east-1'
const dynamo = new DynamoDBClient({ region })
const db = drizzle(neon(process.env.DATABASE_URL!), {
  schema: { tasks, history },
})

const SHOULD_CLEAR = process.argv.includes('--clear')

type RawTask = {
  title: string
  due?: string
  strictDeadline?: boolean
  repeat?: string
  repeatInterval?: number
  repeatUnit?: string
  repeatWeekdays?: boolean[]
  timeFrame?: number | string
  snooze?: string
  subtasks?: Array<{ title: string; done: boolean; snooze?: string }>
}

const REPEATS = new Set([
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
])
const REPEAT_UNITS = new Set(['day', 'week', 'month', 'year'])

function normalizeRepeat(v: unknown): (typeof tasks.$inferSelect)['repeat'] {
  return REPEATS.has(v as string)
    ? (v as (typeof tasks.$inferSelect)['repeat'])
    : 'No Repeat'
}

function normalizeRepeatUnit(
  v: unknown,
): (typeof tasks.$inferSelect)['repeatUnit'] {
  return REPEAT_UNITS.has(v as string)
    ? (v as (typeof tasks.$inferSelect)['repeatUnit'])
    : 'day'
}

function normalizeWeekdays(
  v: unknown,
): [boolean, boolean, boolean, boolean, boolean, boolean, boolean] {
  if (Array.isArray(v) && v.length === 7) {
    return v.map((x) => Boolean(x)) as [
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
    ]
  }
  return [false, false, false, false, false, false, false]
}

function normalizeSubtasks(
  v: unknown,
): Array<{ title: string; done: boolean; snooze?: string }> {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is { title: unknown; done: unknown; snooze?: unknown } =>
      typeof s === 'object' && s !== null && 'title' in s,
    )
    .map((s) => ({
      title: String(s.title ?? ''),
      done: Boolean(s.done),
      ...(typeof s.snooze === 'string' ? { snooze: s.snooze } : {}),
    }))
}

function rawToTaskInsert(raw: RawTask) {
  const tf = typeof raw.timeFrame === 'string' ? parseInt(raw.timeFrame) : raw.timeFrame ?? 0
  return {
    userId,
    title: raw.title,
    due: raw.due ?? 'No Due Date',
    strictDeadline: Boolean(raw.strictDeadline),
    repeat: normalizeRepeat(raw.repeat),
    repeatInterval: typeof raw.repeatInterval === 'number' ? raw.repeatInterval : 1,
    repeatUnit: normalizeRepeatUnit(raw.repeatUnit),
    repeatWeekdays: normalizeWeekdays(raw.repeatWeekdays),
    timeFrame: Number.isFinite(tf) ? tf : 0,
    snooze: typeof raw.snooze === 'string' ? raw.snooze : null,
    subtasks: normalizeSubtasks(raw.subtasks),
  }
}

async function scanAll(tableName: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let exclusiveStartKey: Record<string, unknown> | undefined
  do {
    const res: { Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> } =
      await dynamo.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey: exclusiveStartKey as never,
        }),
      )
    for (const item of res.Items ?? []) out.push(unmarshall(item as never))
    exclusiveStartKey = res.LastEvaluatedKey
  } while (exclusiveStartKey)
  return out
}

function noonOfDateString(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x))
  return new Date(y, m - 1, d, 12, 0, 0)
}

async function main() {
  console.log(`Migrating to Clerk user: ${userId}`)
  console.log(`AWS region: ${region}\n`)

  if (SHOULD_CLEAR) {
    console.log('Clearing existing rows for this user...')
    await db.delete(tasks).where(eq(tasks.userId, userId!))
    await db.delete(history).where(eq(history.userId, userId!))
    console.log('Cleared.\n')
  }

  console.log('Scanning tasks-prod...')
  const rawTasks = (await scanAll('tasks-prod')) as RawTask[]
  console.log(`  Found ${rawTasks.length} tasks`)

  if (rawTasks.length > 0) {
    const rows = rawTasks.map(rawToTaskInsert)
    await db.insert(tasks).values(rows)
    console.log(`  Inserted ${rows.length} tasks ✓`)
  }

  console.log('\nScanning history-prod...')
  const rawHistory = (await scanAll('history-prod')) as Array<{
    date: string
    tasks?: unknown[]
  }>
  console.log(`  Found ${rawHistory.length} day rows`)

  let historyInserts = 0
  const historyBatches: Array<{
    userId: string
    taskId: null
    taskSnapshot: unknown
    completedAt: Date
  }> = []

  for (const row of rawHistory) {
    if (!row.date || !Array.isArray(row.tasks)) continue
    const completedAt = noonOfDateString(row.date)
    for (const t of row.tasks) {
      if (typeof t !== 'object' || t === null) continue
      const snapshot = rawToTaskInsert(t as RawTask)
      historyBatches.push({
        userId: userId!,
        taskId: null,
        taskSnapshot: { ...snapshot, userId: undefined },
        completedAt,
      })
      historyInserts += 1
    }
  }

  if (historyBatches.length > 0) {
    // Insert in chunks to keep the SQL statement size manageable
    const CHUNK = 200
    for (let i = 0; i < historyBatches.length; i += CHUNK) {
      const slice = historyBatches.slice(i, i + CHUNK)
      await db.insert(history).values(slice)
    }
    console.log(`  Inserted ${historyInserts} history events ✓`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
