export type UUID = string

export type User = {
  id: UUID
  email: string
  displayName?: string
  createdAt: string
}

export type Device = {
  id: UUID
  userId: UUID
  name?: string
  publicKey: string
  fingerprint: string
  metadata?: Record<string, unknown>
  registeredAt: string
  revoked?: boolean
}

export type Project = {
  id: UUID
  name: string
  slug: string
  ownerId?: UUID
  createdAt: string
}

export type Environment = {
  id: UUID
  projectId: UUID
  name: string
}

export type Secret = {
  id: UUID
  projectId: UUID
  environmentId: UUID
  name: string
  version: number
  createdBy?: UUID
  createdAt: string
}
