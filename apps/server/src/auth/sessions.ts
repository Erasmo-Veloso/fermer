import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db'
import { sessions } from '../schema'

export function hashRefreshToken(refreshToken: string): string {
  return createHash('sha256').update(refreshToken).digest('hex')
}

export async function createSession(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
  await db.insert(sessions).values({
    userId,
    refreshTokenHash: hashRefreshToken(refreshToken),
    expiresAt
  })
}

export async function revokeSession(refreshToken: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.refreshTokenHash, hashRefreshToken(refreshToken)))
}

export async function findActiveSession(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken)
  const [session] = await db.select().from(sessions).where(eq(sessions.refreshTokenHash, tokenHash)).limit(1)
  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  return session
}
