import type { NextFunction, Request, Response } from 'express'
import { ZodError, z } from 'zod'

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body)
      next()
    } catch (error) {
      next(error)
    }
  }
}

export const requestValidationMiddleware = (_req: Request, _res: Response, next: NextFunction) => {
  next()
}

export function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError
}
