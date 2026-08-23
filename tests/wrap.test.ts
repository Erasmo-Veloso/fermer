import { describe, it, expect } from 'vitest';
import { generateKeyPair, randomKey } from '../src/crypto/index';
import { wrapProjectKey, unwrapProjectKey } from '../src/crypto/wrap';

describe('crypto/wrap: project key wrapping via ECDH', () => {
  it('wraps and unwraps a project key for a member', () => {
    const member = generateKeyPair();
    const projectKey = randomKey(32);

    const wrapped = wrapProjectKey(projectKey, member.publicKey);
    const unwrapped = unwrapProjectKey(wrapped, member.privateKey);

    expect(unwrapped.equals(projectKey)).toBe(true);
  });

  it('fails to unwrap with the wrong private key', () => {
    const member = generateKeyPair();
    const attacker = generateKeyPair();
    const projectKey = randomKey(32);

    const wrapped = wrapProjectKey(projectKey, member.publicKey);

    expect(() => unwrapProjectKey(wrapped, attacker.privateKey)).toThrow();
  });

  it('fails to unwrap if the ciphertext is tampered with', () => {
    const member = generateKeyPair();
    const projectKey = randomKey(32);

    const wrapped = wrapProjectKey(projectKey, member.publicKey);
    const tampered = { ...wrapped, ciphertext: Buffer.from('tampered-data').toString('base64') };

    expect(() => unwrapProjectKey(tampered, member.privateKey)).toThrow();
  });

  it('produces different wrapped output for the same key on repeated calls', () => {
    const member = generateKeyPair();
    const projectKey = randomKey(32);

    const wrappedA = wrapProjectKey(projectKey, member.publicKey);
    const wrappedB = wrapProjectKey(projectKey, member.publicKey);

    expect(wrappedA.ciphertext).not.toBe(wrappedB.ciphertext);
    expect(unwrapProjectKey(wrappedB, member.privateKey).equals(projectKey)).toBe(true);
  });
});
