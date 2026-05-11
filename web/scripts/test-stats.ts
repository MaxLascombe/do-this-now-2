import 'dotenv/config'

import { tasks } from '@dtn/shared/schema'
import { db } from '../src/db'
import { getStats } from '../src/server/lib/stats'

async function main() {
  const rows = await db
    .select({ userId: tasks.userId })
    .from(tasks)
    .limit(1)
  if (rows.length === 0) {
    console.log('No tasks; no userId to test with')
    return
  }
  const userId = rows[0].userId
  console.log('Testing getStats with userId =', userId.slice(0, 15) + '...')
  try {
    const result = await getStats(userId, 300)
    console.log('SUCCESS. Stats summary:')
    console.log('  totalAllTime:', result.totalAllTime)
    console.log('  totalDaysHit:', result.totalDaysHit)
    console.log('  heatmap days:', result.heatmap.length)
    console.log('  hits:', result.heatmap.filter((h) => h.hit).length)
    console.log('  topTasks:', result.topTasks.length)
    console.log('  emojiFreq:', result.emojiFreq.length)
    console.log('  snoozesAllTime:', result.snoozesAllTime)
    console.log('  currentStreak:', result.currentStreak)
    console.log('  longestStreak:', result.longestStreak)
  } catch (e) {
    console.error('THREW:', (e as Error).message)
    console.error((e as Error).stack)
  }
}

main().then(() => process.exit(0))
