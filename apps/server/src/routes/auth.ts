import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { users } from '../schema'
import { createTokenPair, verifyRefreshToken } from '../auth'
import { hashPassword, verifyPassword } from '../auth/password'
import { createSession, findActiveSession, revokeSession } from '../auth/sessions'
import { requireAuth, type AuthenticatedRequest } from '../auth/request'
import { HttpError } from '../middleware/error'
import { validateBody } from '../middleware/validation'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

const logoutSchema = z.object({
  refreshToken: z.string().min(1)
})

function safeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? undefined,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  }
}

async function issueTokens(userId: string) {
  const tokenPair = createTokenPair({ userId })
  await createSession(userId, tokenPair.refreshToken, new Date(tokenPair.refreshExpiresAt))
  return tokenPair
}

const authRouter = Router()

authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, displayName } = req.body as z.infer<typeof registerSchema>
    const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (existingUser) {
      throw new HttpError(409, 'Email is already registered')
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashPassword(password),
        displayName: displayName ?? null
      })
      .returning()

    const tokenPair = await issueTokens(createdUser.id)
    res.status(201).json({
      ok: true,
      user: safeUser(createdUser),
      tokens: tokenPair
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>
    const user = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new HttpError(401, 'Invalid email or password')
    }

    const [updatedUser] = await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id))
      .returning()

    const tokenPair = await issueTokens(user.id)
    res.json({
      ok: true,
      user: safeUser(updatedUser ?? user),
      tokens: tokenPair
    })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/me', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.auth?.userId) {
      throw new HttpError(401, 'Authentication required')
    }

    const user = await db.query.users.findFirst({ where: eq(users.id, req.auth.userId) })
    if (!user) {
      throw new HttpError(404, 'User not found')
    }

    res.json({ ok: true, user: safeUser(user) })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/logout', validateBody(logoutSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body as z.infer<typeof logoutSchema>
    const subject = verifyRefreshToken(refreshToken)
    const session = await findActiveSession(refreshToken)
    if (!session || session.userId !== subject.userId) {
      throw new HttpError(401, 'Invalid or expired refresh token')
    }

    await revokeSession(refreshToken)
    res.status(204).send()
  } catch (error) {
    next(error)
  }
})

export { authRouter }
