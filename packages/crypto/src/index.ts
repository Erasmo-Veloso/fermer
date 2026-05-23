import { randomBytes, createCipheriv, createDecipheriv, generateKeyPairSync, createECDH } from 'node:crypto'

export type KeyPair = { publicKey: string; privateKey: string }

export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } })
  return { publicKey, privateKey }
}

export function randomKey(bytes = 32): Buffer {
  return randomBytes(bytes)
}

// AES-256-GCM helpers
export function encryptAesGcm(plaintext: Buffer, key: Buffer): { iv: string; ciphertext: string; tag: string } {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return { iv: iv.toString('base64'), ciphertext: ciphertext.toString('base64'), tag: tag.toString('base64') }
}

export function decryptAesGcm(iv_b64: string, ciphertext_b64: string, tag_b64: string, key: Buffer): Buffer {
  const iv = Buffer.from(iv_b64, 'base64')
  const tag = Buffer.from(tag_b64, 'base64')
  const ciphertext = Buffer.from(ciphertext_b64, 'base64')
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext
}

// Simple ECDH-derived shared secret helper (for demonstration)
export function deriveSharedSecret(privateKeyPem: string, otherPublicKeyPem: string): Buffer {
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(privateKeyPem, 'pem')
  const secret = ecdh.computeSecret(otherPublicKeyPem, 'pem')
  return secret
}
