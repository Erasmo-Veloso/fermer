import { generateKeyPairSync, createSign, createVerify, createHash } from 'node:crypto';

export function generateDeviceKeypair(): {
  privateKeyPem: string;
  publicKeyPem: string;
  fingerprint: string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;
  const fingerprint = computeFingerprint(publicKeyPem);
  return { privateKeyPem, publicKeyPem, fingerprint };
}

export function computeFingerprint(publicKeyPem: string): string {
  return createHash('sha256').update(publicKeyPem).digest('hex');
}

export function signPayload(privateKeyPem: string, payload: string): string {
  const signer = createSign('SHA256');
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem, 'base64');
}

export function verifySignature(
  publicKeyPem: string,
  payload: string,
  signatureB64: string,
): boolean {
  const verifier = createVerify('SHA256');
  verifier.update(payload);
  verifier.end();
  return verifier.verify(publicKeyPem, signatureB64, 'base64');
}
