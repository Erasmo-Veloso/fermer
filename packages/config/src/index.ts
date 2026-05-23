/**
 * Minimal shared environment loader.
 * Replace validation with Zod or equivalent in later phases.
 */

export type Env = {
  NODE_ENV?: string;
  PORT?: string;
  DATABASE_URL?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_TTL?: string;
  JWT_REFRESH_TTL?: string;
};

export function loadEnv(): Env {
  return {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL,
  };
}

export function requireEnv(key: keyof Env): string {
  const v = process.env[key as string];
  if (!v) throw new Error(`Missing required env: ${String(key)}`);
  return v;
}
