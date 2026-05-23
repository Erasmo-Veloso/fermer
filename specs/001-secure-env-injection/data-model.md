# Data Model: Secure Environment Variable Distribution

This document describes the primary database entities, fields, relationships, and indexes for v1.

Notes: Use `uuid` primary keys, `timestamp with time zone` for times, and `bytea` for encrypted payloads. Use Drizzle ORM migrations to materialize the schema.

## users

- `id` UUID PRIMARY KEY
- `email` text UNIQUE NOT NULL
- `password_hash` text NULL (nullable if using SSO/external providers)
- `display_name` text
- `created_at` timestamptz NOT NULL DEFAULT now()
- `last_login_at` timestamptz NULL

Indexes: unique(email)

## devices

- `id` UUID PRIMARY KEY
- `user_id` UUID REFERENCES users(id) ON DELETE CASCADE
- `name` text
- `public_key` text NOT NULL
- `fingerprint` text NOT NULL
- `metadata` jsonb NULL
- `registered_at` timestamptz NOT NULL DEFAULT now()
- `revoked` boolean NOT NULL DEFAULT false

Indexes: index on `user_id`, index on `fingerprint`, partial index on `revoked`.

## projects

- `id` UUID PRIMARY KEY
- `name` text NOT NULL
- `slug` text NOT NULL UNIQUE
- `owner_id` UUID REFERENCES users(id)
- `created_at` timestamptz NOT NULL DEFAULT now()
- `metadata` jsonb NULL

Indexes: unique(slug), index on owner_id

## environments

- `id` UUID PRIMARY KEY
- `project_id` UUID REFERENCES projects(id) ON DELETE CASCADE
- `name` text NOT NULL -- e.g., development, staging, production
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes: composite index on (project_id, name)

## secrets

- `id` UUID PRIMARY KEY
- `project_id` UUID REFERENCES projects(id) ON DELETE CASCADE
- `environment_id` UUID REFERENCES environments(id) ON DELETE CASCADE
- `name` text NOT NULL -- secret key name
- `encrypted_value` bytea NOT NULL -- AES-256-GCM ciphertext including auth tag
- `version` integer NOT NULL DEFAULT 1
- `created_by` UUID REFERENCES users(id)
- `created_at` timestamptz NOT NULL DEFAULT now()
- `updated_at` timestamptz NULL
- `metadata` jsonb NULL

Constraints & Indexes:
- Unique constraint on (project_id, environment_id, name)
- Index on (project_id, environment_id)

## project_members

- `id` UUID PRIMARY KEY
- `project_id` UUID REFERENCES projects(id) ON DELETE CASCADE
- `user_id` UUID REFERENCES users(id) ON DELETE CASCADE
- `role` text NOT NULL -- e.g., admin, developer, reader
- `granted_at` timestamptz NOT NULL DEFAULT now()

Indexes: composite unique (project_id, user_id)

## wrapped_keys

Store per-device wrapped project keys allowing revocation without re-encrypting all secrets.

- `id` UUID PRIMARY KEY
- `project_id` UUID REFERENCES projects(id) ON DELETE CASCADE
- `device_id` UUID REFERENCES devices(id) ON DELETE CASCADE
- `wrapped_key` bytea NOT NULL -- project key encrypted with device public key
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes: composite unique (project_id, device_id)

## audit_logs

- `id` UUID PRIMARY KEY
- `project_id` UUID REFERENCES projects(id) NULL
- `user_id` UUID REFERENCES users(id) NULL
- `device_id` UUID REFERENCES devices(id) NULL
- `action` text NOT NULL -- e.g., secret_retrieved, login, device_registered
- `resource_type` text NULL -- e.g., secret, project
- `resource_id` UUID NULL
- `metadata` jsonb NULL -- additional context (ip, user-agent, reason)
- `created_at` timestamptz NOT NULL DEFAULT now()

Indexes: index on (project_id), index on (user_id), index on (device_id), index on (action)

## Recommendations

- Use sensible retention for `audit_logs` and consider archiving older records.
- Store `encrypted_value` as `bytea` with schema versioning in `metadata` to support future changes to encryption format.
- Provide migration scripts that create the `wrapped_keys` table so devices may be revoked by deleting their wrapped_key row.
