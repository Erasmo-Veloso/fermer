import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthenticatedRequest } from '../auth/request';
import { db } from '../db';
import { devices } from '../schema';
import { computeFingerprint, verifySignature } from '../../../../packages/crypto/src/device';
import { validateBody } from '../middleware/validation';
import { HttpError } from '../middleware/error';

const registerSchema = z.object({
  name: z.string().min(1).optional(),
  publicKey: z.string().min(1),
  signature: z.string().min(1),
  timestamp: z.number().int(),
  metadata: z.any().optional(),
});

const devicesRouter = Router();

devicesRouter.post(
  '/register',
  requireAuth,
  validateBody(registerSchema),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { name, publicKey, signature, timestamp, metadata } = req.body as z.infer<
        typeof registerSchema
      >;
      if (!req.auth?.userId) throw new HttpError(401, 'Authentication required');

      const now = Date.now();
      if (Math.abs(now - timestamp) > 1000 * 60 * 5) {
        throw new HttpError(400, 'Timestamp is out of allowed range');
      }

      const payload = `${publicKey}:${req.auth.userId}:${timestamp}`;
      const valid = verifySignature(publicKey, payload, signature);
      if (!valid) throw new HttpError(401, 'Invalid device signature');

      const fingerprint = computeFingerprint(publicKey);

      const [created] = await db
        .insert(devices)
        .values({
          userId: req.auth.userId,
          name: name ?? null,
          publicKey,
          fingerprint,
          metadata: metadata ?? null,
        })
        .returning();

      res
        .status(201)
        .json({
          ok: true,
          device: {
            id: created.id,
            fingerprint: created.fingerprint,
            name: created.name,
            registeredAt: created.registeredAt,
          },
        });
    } catch (err) {
      next(err);
    }
  },
);

export { devicesRouter };
