import type { NextFunction, Request, Response } from 'express'
import { HttpError } from '../middleware/error'
import { verifyAccessToken } from './tokens'

export type AuthenticatedRequest = Request & {
  auth?: ReturnType<typeof verifyAccessToken>
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Authorization header is required'))
    return
  }

  try {
    req.auth = verifyAccessToken(header.slice('Bearer '.length))
    next()
  } catch {
    next(new HttpError(401, 'Invalid or expired access token'))
  }
}
