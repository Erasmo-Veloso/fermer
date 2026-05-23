import express, { type Express } from 'express'
import { requestValidationMiddleware } from './middleware/validation'
import { errorHandler } from './middleware/error'
import { registerRoutes } from './routes'

export function createApp(): Express {
  const app = express()

  app.use(express.json())
  app.use(requestValidationMiddleware)

  registerRoutes(app)

  app.use(errorHandler)

  return app
}
