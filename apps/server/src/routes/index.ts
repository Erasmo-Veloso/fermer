import type { Express } from 'express'
import { Router } from 'express'
import { authRouter } from './auth'

function createPlaceholderRouter(name: string) {
  const router = Router()
  router.use((_req, _res, next) => {
    next()
  })
  router.get('/', (_req, res) => {
    res.status(501).json({ ok: false, scope: name, message: 'Not implemented yet' })
  })
  return router
}

export function registerRoutes(app: Express) {
  app.get('/_health', (_req, res) => {
    res.json({ ok: true })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/projects', createPlaceholderRouter('projects'))
  app.use('/api/secrets', createPlaceholderRouter('secrets'))
  app.use('/api/devices', createPlaceholderRouter('devices'))
}
