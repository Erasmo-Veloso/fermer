import { Router } from 'express';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../auth/request';
import { db } from '../db';
import { projects, projectMembers } from '../schema';
import { validateBody } from '../middleware/validation';
import { HttpError } from '../middleware/error';
import { logPermissionEvent } from '../audit';

const createProjectSchema = z.object({
  name: z.string().min(1),
  metadata: z.any().optional(),
});

const inviteSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['admin', 'developer', 'reader']).optional(),
});

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

const projectsRouter = Router();

projectsRouter.post(
  '/',
  requireAuth,
  validateBody(createProjectSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, metadata } = req.body as z.infer<typeof createProjectSchema>;
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      let base = slugify(name);
      let slug = base;
      // ensure slug uniqueness
      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const existing = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
        if (existing.length === 0) break;
        attempt += 1;
        slug = `${base}-${Date.now().toString(36).slice(-4)}-${attempt}`;
        if (attempt > 5) break;
      }

      const [created] = await db
        .insert(projects)
        .values({
          name,
          slug,
          ownerId: req.auth.userId,
          metadata: metadata ?? null,
        })
        .returning();

      // add owner to project_members
      await db.insert(projectMembers).values({
        projectId: created.id,
        userId: req.auth.userId,
        role: 'admin',
      });

      res.status(201).json({
        ok: true,
        project: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          createdAt: created.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.post(
  '/:projectId/invite',
  requireAuth,
  validateBody(inviteSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { projectId } = req.params;
      const { userId, role } = req.body as z.infer<typeof inviteSchema>;
      const projectIdStr = String(projectId);
      const targetUserId = String(userId);
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      // check permission: requester must be project owner or admin
      const proj = await db.select().from(projects).where(eq(projects.id, projectIdStr)).limit(1);
      if (proj.length === 0) throw new HttpError(404, 'Project not found');
      const project = proj[0];
      if (project.ownerId !== req.auth.userId) {
        // check project_members for admin role
        const pm = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, projectIdStr),
              eq(projectMembers.userId, req.auth.userId),
            ),
          )
          .limit(1);
        if (pm.length === 0 || (pm[0].role !== 'admin' && pm[0].role !== 'developer')) {
          throw new HttpError(403, 'Insufficient permissions to invite members');
        }
      }

      await db
        .insert(projectMembers)
        .values({ projectId: projectIdStr, userId: targetUserId, role: role ?? 'developer' });

      try {
        await logPermissionEvent({
          projectId: projectIdStr,
          userId: req.auth.userId,
          action: 'invite',
          resourceId: targetUserId,
        });
      } catch {}

      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

projectsRouter.delete(
  '/:projectId/members/:userId',
  requireAuth,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { projectId, userId } = req.params;
      const projectIdStr = String(projectId);
      const targetUserId = String(userId);
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      const proj = await db.select().from(projects).where(eq(projects.id, projectIdStr)).limit(1);
      if (proj.length === 0) throw new HttpError(404, 'Project not found');
      const project = proj[0];
      if (project.ownerId !== req.auth.userId) {
        const pm = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, projectIdStr),
              eq(projectMembers.userId, req.auth.userId),
            ),
          )
          .limit(1);
        if (pm.length === 0 || pm[0].role !== 'admin') {
          throw new HttpError(403, 'Insufficient permissions to remove members');
        }
      }

      await db
        .delete(projectMembers)
        .where(
          and(eq(projectMembers.projectId, projectIdStr), eq(projectMembers.userId, targetUserId)),
        );

      try {
        await logPermissionEvent({
          projectId: projectIdStr,
          userId: req.auth.userId,
          action: 'remove',
          resourceId: targetUserId,
        });
      } catch {}

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

export { projectsRouter };
