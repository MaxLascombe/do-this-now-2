import 'dotenv/config'
import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

import { history } from '../src/db/schema'

const userId = process.env.MIGRATION_USER_ID!
const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const db = drizzle(neon(process.env.DATABASE_URL!))

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function noonOfDateString(s: string): Date {
  const [y, m, d] = s.split('-').map((x) => parseInt(x))
  return new Date(y, m - 1, d, 12, 0, 0)
}

function snapshotFromRaw(t: Record<string, unknown>) {
  const tf = typeof t.timeFrame === 'string' ? parseInt(t.timeFrame) : (t.timeFrame as number) ?? 0
  return {
    title: String(t.title ?? ''),
    due: typeof t.due === 'string' ? t.due : 'No Due Date',
    strictDeadline: Boolean(t.strictDeadline),
    repeat: REPEATS.has(t.repeat as string) ? (t.repeat as string) : 'No Repeat',
    repeatInterval: typeof t.repeatInterval === 'number' ? t.repeatInterval : 1,
    repeatUnit: REPEAT_UNITS.has(t.repeatUnit as string) ? (t.repeatUnit as string) : 'day',
    repeatWeekdays: Array.isArray(t.repeatWeekdays) && t.repeatWeekdays.length === 7
      ? t.repeatWeekdays.map(Boolean)
      : [false, false, false, false, false, false, false],
    timeFrame: Number.isFinite(tf) ? tf : 0,
    snooze: typeof t.snooze === 'string' ? t.snooze : null,
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
  }
}

async function main() {
  console.log(`Scanning history-prod with throttling (page=10, 1s delay between pages)...`)

  let exclusiveStartKey: Record<string, unknown> | undefined
  const allRows: Array<{ date: string; tasks: unknown[] }> = []
  let pageNum = 0

  do {
    pageNum += 1
    let attempt = 0
    let res
    while (true) {
      try {
        res = await dynamo.send(
          new ScanCommand({
            TableName: 'history-prod',
            Limit: 10,
            ExclusiveStartKey: exclusiveStartKey as never,
          }),
        )
        break
      } catch (err) {
        attempt += 1
        const isThrottle =
          err instanceof Error &&
          (err.name === 'ProvisionedThroughputExceededException' ||
            err.message.includes('ThroughputExceeded'))
        if (!isThrottle || attempt > 6) throw err
        const wait = Math.min(30_000, 1000 * 2 ** attempt)
        console.log(`  ⚠ throttled, waiting ${wait}ms (attempt ${attempt})`)
        await sleep(wait)
      }
    }

    for (const item of res.Items ?? []) {
      const u = unmarshall(item as never) as { date: string; tasks?: unknown[] }
      if (u.date && Array.isArray(u.tasks)) allRows.push({ date: u.date, tasks: u.tasks })
    }
    exclusiveStartKey = res.LastEvaluatedKey
    console.log(`  page ${pageNum}: ${res.Items?.length ?? 0} rows (running total ${allRows.length})`)
    await sleep(1000)
  } while (exclusiveStartKey)

  console.log(`\nTotal day-rows: ${allRows.length}`)

  const inserts: Array<{
    userId: string
    taskId: null
    taskSnapshot: unknown
    completedAt: Date
  }> = []

  for (const row of allRows) {
    const completedAt = noonOfDateString(row.date)
    for (const t of row.tasks) {
      if (typeof t !== 'object' || t === null) continue
      inserts.push({
        userId,
        taskId: null,
        taskSnapshot: snapshotFromRaw(t as Record<string, unknown>),
        completedAt,
      })
    }
  }

  console.log(`Total completion events: ${inserts.length}`)

  const CHUNK = 200
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const slice = inserts.slice(i, i + CHUNK)
    await db.insert(history).values(slice)
    console.log(`  inserted ${i + slice.length}/${inserts.length}`)
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
