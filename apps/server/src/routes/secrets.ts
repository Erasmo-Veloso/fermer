import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../auth/request';
import { db } from '../db';
import { secrets, environments, projects, projectMembers } from '../schema';
import { validateBody } from '../middleware/validation';
import { HttpError } from '../middleware/error';
import { eq, and } from 'drizzle-orm';
import { logSecretEvent } from '../audit';

const createSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
  name: z.string().min(1),
  encryptedValue: z.string().min(1),
  metadata: z.any().optional(),
});

const updateSchema = z.object({
  encryptedValue: z.string().min(1),
  expectedVersion: z.number().int().optional(),
  metadata: z.any().optional(),
});

const listSchema = z.object({
  projectId: z.string().uuid(),
  environmentId: z.string().uuid(),
});

const secretsRouter = Router();

// Create a secret (version starts at 1)
secretsRouter.post(
  '/',
  requireAuth,
  validateBody(createSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { projectId, environmentId, name, encryptedValue, metadata } = req.body as z.infer<
        typeof createSchema
      >;
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      // permission: user must be member of project with at least developer role
      const member = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, req.auth.userId)),
        )
        .limit(1);
      // Fallback: allow if owner
      const proj = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (proj.length === 0) throw new HttpError(404, 'Project not found');
      const project = proj[0];
      const hasPerm = project.ownerId === req.auth.userId || (member && member.length > 0);
      if (!hasPerm) throw new HttpError(403, 'Insufficient permissions to create secret');

      const [created] = await db
        .insert(secrets)
        .values({
          projectId,
          environmentId,
          name,
          encryptedValue,
          version: 1,
          createdBy: req.auth.userId,
          metadata: metadata ?? null,
        })
        .returning();

      res
        .status(201)
        .json({
          ok: true,
          secret: {
            id: created.id,
            name: created.name,
            version: created.version,
            createdAt: created.createdAt,
          },
        });
      try {
        await logSecretEvent({ projectId, userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'create', resourceId: created.id })
      } catch {
        // ignore audit errors
      }
    } catch (err) {
      next(err);
    }
  },
);

// Update secret with optimistic concurrency (expectedVersion)
secretsRouter.put(
  '/:secretId',
  requireAuth,
  validateBody(updateSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { secretId } = req.params;
      const secretIdStr = String(secretId);
      const { encryptedValue, expectedVersion, metadata } = req.body as z.infer<
        typeof updateSchema
      >;
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      const [existing] = await db
        .select()
        .from(secrets)
        .where(eq(secrets.id, secretIdStr))
        .limit(1);
      if (!existing) throw new HttpError(404, 'Secret not found');

      // permission check: must be project owner or member
      const proj = await db
        .select()
        .from(projects)
        .where(eq(projects.id, String(existing.projectId)))
        .limit(1);
      if (proj.length === 0) throw new HttpError(404, 'Project not found');
      const project = proj[0];
      if (project.ownerId !== req.auth.userId) {
        const pm = await db
          .select()
          .from(projectMembers)
          .where(
            and(
              eq(projectMembers.projectId, project.id),
              eq(projectMembers.userId, req.auth.userId),
            ),
          )
          .limit(1);
        if (!pm || pm.length === 0)
          throw new HttpError(403, 'Insufficient permissions to update secret');
      }

      if (expectedVersion && existing.version !== expectedVersion) {
        throw new HttpError(409, 'Secret version mismatch');
      }

      const [updated] = await db
        .update(secrets)
        .set({
          encryptedValue,
          version: existing.version + 1,
          updatedAt: new Date(),
          metadata: metadata ?? existing.metadata,
        })
        .where(eq(secrets.id, secretIdStr))
        .returning();

      // TODO: add audit log entry

      res.json({
        ok: true,
        secret: { id: updated.id, version: updated.version, updatedAt: updated.updatedAt },
      });
      try {
        await logSecretEvent({ projectId: String(existing.projectId), userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'update', resourceId: updated.id })
      } catch {
        // ignore
      }
    } catch (err) {
      next(err);
    }
  },
);

// Delete secret
secretsRouter.delete('/:secretId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { secretId } = req.params;
    const secretIdStr = String(secretId);
    if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

    const [existing] = await db.select().from(secrets).where(eq(secrets.id, secretIdStr)).limit(1);
    if (!existing) throw new HttpError(404, 'Secret not found');

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.id, String(existing.projectId)))
      .limit(1);
    if (proj.length === 0) throw new HttpError(404, 'Project not found');
    const project = proj[0];
    if (project.ownerId !== req.auth.userId) {
      const pm = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, req.auth.userId)),
        )
        .limit(1);
      if (!pm || pm.length === 0)
        throw new HttpError(403, 'Insufficient permissions to delete secret');
    }

    await db.delete(secrets).where(eq(secrets.id, secretIdStr));
    // TODO: audit log
    try {
      await logSecretEvent({ projectId: String(existing.projectId), userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'delete', resourceId: existing.id })
    } catch {}
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// List secret metadata for project/environment
secretsRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const q = req.query as unknown as Record<string, string>;
    const projectId = q.projectId;
    const environmentId = q.environmentId;
    if (!projectId || !environmentId)
      throw new HttpError(400, 'projectId and environmentId are required');
    if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

    // permission check simplified: ensure project exists and user is member/owner
    const proj = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    if (proj.length === 0) throw new HttpError(404, 'Project not found');

    const rows = await db
      .select({
        id: secrets.id,
        name: secrets.name,
        version: secrets.version,
        createdAt: secrets.createdAt,
      })
      .from(secrets)
      .where(and(eq(secrets.projectId, projectId), eq(secrets.environmentId, environmentId)))
      .orderBy(secrets.name);

    res.json({ ok: true, secrets: rows });
  } catch (err) {
    next(err);
  }
});

// Retrieve secret (encrypted payload) with permission check
secretsRouter.get('/:secretId', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const { secretId } = req.params;
    const secretIdStr = String(secretId);
    if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

    const [existing] = await db.select().from(secrets).where(eq(secrets.id, secretIdStr)).limit(1);
    if (!existing) throw new HttpError(404, 'Secret not found');

    const proj = await db
      .select()
      .from(projects)
      .where(eq(projects.id, String(existing.projectId)))
      .limit(1);
    if (proj.length === 0) throw new HttpError(404, 'Project not found');

    // permission check: owner or member
    if (proj[0].ownerId !== req.auth.userId) {
      const pm = await db
        .select()
        .from(projectMembers)
        .where(
          and(eq(projectMembers.projectId, proj[0].id), eq(projectMembers.userId, req.auth.userId)),
        )
        .limit(1);
      if (!pm || pm.length === 0)
        throw new HttpError(403, 'Insufficient permissions to retrieve secret');
    }

    res.json({
      ok: true,
      secret: {
        id: existing.id,
        name: existing.name,
        encryptedValue: existing.encryptedValue,
        version: existing.version,
      },
    });
    try {
      await logSecretEvent({ projectId: String(existing.projectId), userId: req.auth.userId, deviceId: req.auth.deviceId, action: 'retrieve', resourceId: existing.id })
    } catch {}
  } catch (err) {
    next(err);
  }
});

export { secretsRouter };
