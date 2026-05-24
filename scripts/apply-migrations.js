const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Client } = require('pg');

async function main() {
  const migrationsDir = path.join(__dirname, '..', 'apps', 'server', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.log('No SQL migrations found');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL not set in environment. Ensure .env exists.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    for (const file of files) {
      const full = path.join(migrationsDir, file);
      console.log('Applying', file);
      const sql = fs.readFileSync(full, 'utf8');
      await client.query(sql);
      console.log('Applied', file);
    }
    console.log('All migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
