import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { generateDeviceKeypair } from '../crypto/device.js';
import type { Identity } from '../types.js';

export function identityDir(): string {
  const override = process.env.FERMER_HOME;
  return override && override.length > 0 ? override : join(homedir(), '.fermer');
}

export function identityPath(): string {
  return join(identityDir(), 'identity.json');
}

export function identityExists(): boolean {
  return existsSync(identityPath());
}

export function loadIdentity(): Identity {
  const path = identityPath();
  if (!existsSync(path)) {
    throw new Error(`No identity found at ${path}. Run "fermer identity" to create one.`);
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read identity at ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw) as Identity;
  } catch {
    throw new Error(`Identity file at ${path} is not valid JSON.`);
  }
}

export function createIdentity(label: string): Identity {
  if (identityExists()) {
    throw new Error(`An identity already exists at ${identityPath()}.`);
  }
  const { privateKeyPem, publicKeyPem, fingerprint } = generateDeviceKeypair();
  const identity: Identity = {
    version: 1,
    fingerprint,
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
    createdAt: new Date().toISOString(),
    label,
  };
  mkdirSync(identityDir(), { recursive: true, mode: 0o700 });
  writeFileSync(identityPath(), JSON.stringify(identity, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  return identity;
}

export function exportPublicKey(outputPath: string): void {
  const identity = loadIdentity();
  writeFileSync(outputPath, identity.publicKey, 'utf8');
}
