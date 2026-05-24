import type { Express } from 'express';
import { Router } from 'express';
import { authRouter } from './auth';
import { devicesRouter } from './devices';
import { projectsRouter } from './projects';
import { secretsRouter } from './secrets';

function createPlaceholderRouter(name: string) {
  const router = Router();
  router.use((_req, _res, next) => {
    next();
  });
  router.get('/', (_req, res) => {
    res.status(501).json({ ok: false, scope: name, message: 'Not implemented yet' });
  });
  return router;
}

export function registerRoutes(app: Express) {
  app.get('/_health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/secrets', secretsRouter);
  app.use('/api/devices', devicesRouter);
}
