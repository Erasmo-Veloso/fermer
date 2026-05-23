import 'dotenv/config'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './db'

async function main() {
  await migrate(db, { migrationsFolder: './migrations' })
  await pool.end()
  console.log('Drizzle migrations applied successfully')
}

main().catch(async (error) => {
  console.error('Failed to apply migrations')
  console.error(error)
  await pool.end()
  process.exit(1)
})
