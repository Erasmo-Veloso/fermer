import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { loadEnv } from '../../../packages/config/src'
import { db } from './db'
import { createApp } from './app'

const app = createApp()
const env = loadEnv()

app.get('/_health/db', async (_req, res) => {
  try {
    await db.execute(sql`select 1`)
    res.json({ ok: true, env: env.NODE_ENV || 'development', db: 'connected' })
  } catch (_error) {
    res.status(503).json({ ok: false, env: env.NODE_ENV || 'development', db: 'down' })
  }
})

const port = Number(process.env.PORT || 3000)
app.listen(port, () => console.log(`Fermer server listening on ${port}`))
