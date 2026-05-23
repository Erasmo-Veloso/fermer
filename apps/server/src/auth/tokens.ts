import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { loadEnv } from '../../../../packages/config/src'
import type { JwtSubject, TokenPair } from './types'

const env = loadEnv()

function requireSecret(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for JWT authentication`)
  }
  return value
}

function ttlToSeconds(ttl: string | undefined, fallbackSeconds: number): number {
  if (!ttl) return fallbackSeconds
  const match = ttl.match(/^(\d+)([smhd])$/)
  if (!match) return fallbackSeconds
  const value = Number(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 }
  return value * multipliers[unit]
}

export function createTokenPair(subject: JwtSubject): TokenPair {
  const accessSecret = requireSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')
  const refreshSecret = requireSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET')
  const accessExpiresIn = ttlToSeconds(env.JWT_ACCESS_TTL, 60 * 15)
  const refreshExpiresIn = ttlToSeconds(env.JWT_REFRESH_TTL, 60 * 60 * 24 * 7)

  const accessToken = jwt.sign(subject, accessSecret, { expiresIn: accessExpiresIn })
  const refreshToken = jwt.sign({ ...subject, nonce: randomBytes(16).toString('hex') }, refreshSecret, {
    expiresIn: refreshExpiresIn
  })

  return {
    accessToken,
    refreshToken,
    accessExpiresAt: Date.now() + accessExpiresIn * 1000,
    refreshExpiresAt: Date.now() + refreshExpiresIn * 1000
  }
}

export function verifyAccessToken(token: string): JwtSubject {
  const accessSecret = requireSecret(env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET')
  return jwt.verify(token, accessSecret) as JwtSubject
}

export function verifyRefreshToken(token: string): JwtSubject {
  const refreshSecret = requireSecret(env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET')
  const payload = jwt.verify(token, refreshSecret) as JwtSubject & { nonce?: string }
  const { nonce: _nonce, ...subject } = payload
  return subject
}
