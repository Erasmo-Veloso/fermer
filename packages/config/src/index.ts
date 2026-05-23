/**
 * Minimal shared environment loader.
 * Replace validation with Zod or equivalent in later phases.
 */

export type Env = {
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL?: string;
};

export function loadEnv(): Env {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
  };
}

export function requireEnv(key: keyof Env): string {
  const v = process.env[key as string];
  if (!v) throw new Error(`Missing required env: ${String(key)}`);
  return v;
}
