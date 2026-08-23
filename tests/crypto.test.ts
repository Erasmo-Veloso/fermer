import { describe, it, expect } from 'vitest';
import { randomKey, encryptAesGcm, decryptAesGcm, generateKeyPair, deriveKey } from '../src/crypto/index';

describe('crypto: AES-GCM roundtrip and keypair', () => {
  it('encrypts and decrypts with AES-256-GCM', () => {
    const key = randomKey(32);
    const plaintext = Buffer.from('hello fermer');
    const { iv, ciphertext, tag } = encryptAesGcm(plaintext, key);
    const out = decryptAesGcm(iv, ciphertext, tag, key);
    expect(out.toString()).toBe('hello fermer');
  });

  it('generates an EC keypair', () => {
    const kp = generateKeyPair();
    expect(kp.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(kp.privateKey).toContain('BEGIN PRIVATE KEY');
  });

  it('derives a deterministic key from a shared secret via HKDF-SHA256', () => {
    const sharedSecret = randomKey(32);
    const keyA = deriveKey(sharedSecret, 'fermer-wrap-v1');
    const keyB = deriveKey(sharedSecret, 'fermer-wrap-v1');
    expect(keyA.equals(keyB)).toBe(true);
    expect(keyA.length).toBe(32);
  });

  it('derives different keys for different info strings', () => {
    const sharedSecret = randomKey(32);
    const keyA = deriveKey(sharedSecret, 'fermer-wrap-v1');
    const keyB = deriveKey(sharedSecret, 'fermer-wrap-v2');
    expect(keyA.equals(keyB)).toBe(false);
  });
});
