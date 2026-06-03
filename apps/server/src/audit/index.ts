import { db } from '../db';
import { auditLogs } from '../schema';

type AuditParams = {
  projectId?: string | null;
  userId?: string | null;
  deviceId?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function writeAudit(params: AuditParams) {
  const { projectId, userId, deviceId, action, resourceType, resourceId, metadata } = params;
  await db.insert(auditLogs).values({
    projectId: projectId ?? null,
    userId: userId ?? null,
    deviceId: deviceId ?? null,
    action,
    resourceType: resourceType ?? null,
    resourceId: resourceId ?? null,
    metadata: metadata ?? null,
  });
}

export async function logAuthEvent({
  userId,
  deviceId,
  action,
  metadata,
}: {
  userId?: string;
  deviceId?: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await writeAudit({
    userId: userId ?? null,
    deviceId: deviceId ?? null,
    action: `auth.${action}`,
    metadata: metadata ?? null,
  });
}

export async function logSecretEvent({
  projectId,
  userId,
  deviceId,
  action,
  resourceId,
  metadata,
}: {
  projectId?: string;
  userId?: string;
  deviceId?: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await writeAudit({
    projectId: projectId ?? null,
    userId: userId ?? null,
    deviceId: deviceId ?? null,
    action: `secret.${action}`,
    resourceType: 'secret',
    resourceId: resourceId ?? null,
    metadata: metadata ?? null,
  });
}

export async function logPermissionEvent({
  projectId,
  userId,
  deviceId,
  action,
  resourceId,
  metadata,
}: {
  projectId?: string;
  userId?: string;
  deviceId?: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}) {
  await writeAudit({
    projectId: projectId ?? null,
    userId: userId ?? null,
    deviceId: deviceId ?? null,
    action: `permission.${action}`,
    resourceType: 'project_member',
    resourceId: resourceId ?? null,
    metadata: metadata ?? null,
  });
}
