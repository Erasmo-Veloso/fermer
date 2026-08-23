import {
  generateKeyPairSync,
  createSign,
  createVerify,
  createHash,
  createPublicKey,
} from 'node:crypto';

const EXPECTED_CURVE = 'prime256v1';

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

// Node accepts a private key PEM wherever a public key is expected, and PEM text
// survives round-trips through Git and chat apps with its line endings rewritten.
// Both would silently corrupt a fingerprint, so every public key is parsed and
// re-exported before it is hashed or stored.
export function canonicalizePublicKey(pem: string): string {
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(pem)) {
    throw new Error(
      'That file contains a private key. Export the public key instead with "fermer identity --export <path>".',
    );
  }

  let key;
  try {
    key = createPublicKey(pem);
  } catch (err) {
    throw new Error(`Not a valid public key: ${(err as Error).message}`);
  }

  if (key.asymmetricKeyType !== 'ec') {
    throw new Error(`Expected an EC public key, got "${key.asymmetricKeyType}".`);
  }

  const curve = key.asymmetricKeyDetails?.namedCurve;
  if (curve !== EXPECTED_CURVE) {
    throw new Error(`Expected a P-256 (${EXPECTED_CURVE}) public key, got "${curve}".`);
  }

  return key.export({ type: 'spki', format: 'pem' }).toString();
}

export function computeFingerprint(publicKeyPem: string): string {
  return createHash('sha256').update(canonicalizePublicKey(publicKeyPem)).digest('hex');
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
