import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './error';
import { db } from '../db';
import { devices } from '../schema';
import { verifySignature } from '../../../../packages/crypto/src/device';
import { eq } from 'drizzle-orm';

export type DeviceRequest = Request & { device?: { id: string; userId: string | null } };

export async function requireDevice(req: DeviceRequest, _res: Response, next: NextFunction) {
  try {
    const deviceId = (req.headers['x-device-id'] as string) ?? undefined;
    const signature = (req.headers['x-device-signature'] as string) ?? undefined;
    const ts = (req.headers['x-device-timestamp'] as string) ?? undefined;
    if (!deviceId || !signature || !ts) return next(new HttpError(401, 'Device headers required'));

    const timestamp = Number(ts);
    if (Number.isNaN(timestamp) || Math.abs(Date.now() - timestamp) > 1000 * 60 * 5)
      return next(new HttpError(400, 'Invalid device timestamp'));

    const device = await db.query.devices.findFirst({ where: eq(devices.id, deviceId) });
    if (!device || device.revoked) return next(new HttpError(401, 'Device not found or revoked'));

    const payload = `${req.method}:${req.path}:${timestamp}`;
    const ok = verifySignature(device.publicKey, payload, signature);
    if (!ok) return next(new HttpError(401, 'Invalid device signature'));

    req.device = { id: device.id, userId: device.userId };
    next();
  } catch (err) {
    next(err);
  }
}
