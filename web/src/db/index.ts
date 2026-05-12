import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import * as schema from '@dtn/shared/schema'

// neon-http (one-shot HTTP per query) doesn't support db.transaction(),
// which silently broke completeTask + snoozeTask after batch D/I/O
// wrapped them in db.transaction. neon-serverless uses WebSockets
// against the same Neon endpoint and supports real transactions while
// still working in Vercel's serverless functions.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
export const db = drizzle(pool, { schema })
