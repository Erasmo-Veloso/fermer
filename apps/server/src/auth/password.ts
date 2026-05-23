import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SALT_LENGTH = 16
const KEY_LENGTH = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = scryptSync(password, salt, KEY_LENGTH).toString('hex')
  return `${salt}:${derivedKey}`
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':')
  if (!salt || !key) return false

  const derivedKey = scryptSync(password, salt, KEY_LENGTH)
  const storedKey = Buffer.from(key, 'hex')
  if (storedKey.length !== derivedKey.length) return false

  return timingSafeEqual(storedKey, derivedKey)
}
