import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  displayName: text('display_name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true })
})

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    fingerprint: text('fingerprint').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    registeredAt: timestamp('registered_at', { withTimezone: true }).defaultNow().notNull(),
    revoked: boolean('revoked').default(false).notNull()
  },
  (table) => ({
    userIdIdx: index('idx_devices_user_id').on(table.userId),
    fingerprintIdx: index('idx_devices_fingerprint').on(table.fingerprint)
  })
)

export const projects = pgTable('projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown> | null>()
})

export const environments = pgTable(
  'environments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectNameIdx: uniqueIndex('idx_env_project_name').on(table.projectId, table.name)
  })
)

export const secrets = pgTable(
  'secrets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    encryptedValue: text('encrypted_value').notNull(),
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>()
  },
  (table) => ({
    uniqueSecretIdx: uniqueIndex('idx_secrets_unique').on(table.projectId, table.environmentId, table.name),
    projectEnvIdx: index('idx_secrets_project_env').on(table.projectId, table.environmentId)
  })
)

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    uniqueMemberIdx: uniqueIndex('idx_project_members_unique').on(table.projectId, table.userId)
  })
)

export const wrappedKeys = pgTable(
  'wrapped_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id, { onDelete: 'cascade' }),
    wrappedKey: text('wrapped_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    uniqueWrappedKeyIdx: uniqueIndex('idx_wrapped_keys_unique').on(table.projectId, table.deviceId)
  })
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id'),
    userId: uuid('user_id'),
    deviceId: uuid('device_id'),
    action: text('action').notNull(),
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
  },
  (table) => ({
    projectIdx: index('idx_audit_project').on(table.projectId),
    userIdx: index('idx_audit_user').on(table.userId),
    deviceIdx: index('idx_audit_device').on(table.deviceId)
  })
)
