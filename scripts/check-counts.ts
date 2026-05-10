import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import { tasks, history } from '../src/db/schema'

const db = drizzle(neon(process.env.DATABASE_URL!))
const userId = process.env.MIGRATION_USER_ID!
const t = await db.select().from(tasks).where(eq(tasks.userId, userId))
const h = await db.select().from(history).where(eq(history.userId, userId))
console.log('tasks:', t.length, 'history:', h.length)
