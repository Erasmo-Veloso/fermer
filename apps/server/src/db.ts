import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { loadEnv } from '../../../packages/config/src';
import * as schema from './schema';

const env = loadEnv();

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the server database connection');
}

export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool, { schema });
