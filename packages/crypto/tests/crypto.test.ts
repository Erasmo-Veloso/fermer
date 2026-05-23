import { describe, it, expect } from 'vitest'
import { randomKey, encryptAesGcm, decryptAesGcm, generateKeyPair } from '../src/index'

describe('crypto: AES-GCM roundtrip and keypair', () => {
  it('encrypts and decrypts with AES-256-GCM', () => {
    const key = randomKey(32)
    const plaintext = Buffer.from('hello fermer')
    const { iv, ciphertext, tag } = encryptAesGcm(plaintext, key)
    const out = decryptAesGcm(iv, ciphertext, tag, key)
    expect(out.toString()).toBe('hello fermer')
  })

  it('generates an EC keypair', () => {
    const kp = generateKeyPair()
    expect(kp.publicKey).toContain('BEGIN PUBLIC KEY')
    expect(kp.privateKey).toContain('BEGIN PRIVATE KEY')
  })
})
