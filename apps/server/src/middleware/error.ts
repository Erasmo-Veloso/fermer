import type { ErrorRequestHandler } from 'express'

export class HttpError extends Error {
  statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.statusCode = statusCode
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const statusCode = error instanceof HttpError ? error.statusCode : 500
  const message = error instanceof Error ? error.message : 'Internal server error'

  res.status(statusCode).json({
    ok: false,
    error: {
      message,
      statusCode
    }
  })
}
