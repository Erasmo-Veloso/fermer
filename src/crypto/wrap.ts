import { generateKeyPair, deriveSharedSecret, deriveKey, encryptAesGcm, decryptAesGcm } from './index.js';

const WRAP_INFO = 'fermer-wrap-v1';

export interface WrappedKey {
  ephemeralPublicKey: string;
  iv: string;
  ciphertext: string;
  tag: string;
}

export function wrapProjectKey(projectKey: Buffer, memberPublicKeyPem: string): WrappedKey {
  const ephemeral = generateKeyPair();
  const sharedSecret = deriveSharedSecret(ephemeral.privateKey, memberPublicKeyPem);
  const wrappingKey = deriveKey(sharedSecret, WRAP_INFO);
  const { iv, ciphertext, tag } = encryptAesGcm(projectKey, wrappingKey);
  return {
    ephemeralPublicKey: ephemeral.publicKey,
    iv,
    ciphertext,
    tag,
  };
}

export function unwrapProjectKey(wrapped: WrappedKey, memberPrivateKeyPem: string): Buffer {
  const sharedSecret = deriveSharedSecret(memberPrivateKeyPem, wrapped.ephemeralPublicKey);
  const wrappingKey = deriveKey(sharedSecret, WRAP_INFO);
  return decryptAesGcm(wrapped.iv, wrapped.ciphertext, wrapped.tag, wrappingKey);
}
