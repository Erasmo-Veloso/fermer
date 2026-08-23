import { randomKey, encryptAesGcm, decryptAesGcm } from '../crypto/index.js';
import { wrapProjectKey, unwrapProjectKey } from '../crypto/wrap.js';
import { computeFingerprint, canonicalizePublicKey } from '../crypto/device.js';
import {
  readVault,
  writeVault,
  readMembers,
  writeMembers,
  writeVaultAndMembers,
  ensureGitAttributes,
  initializeFermerDir,
} from './format.js';
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import type { Identity, VaultFile, MembersFile } from '../types.js';

const DEFAULT_ENVIRONMENTS = ['development', 'staging', 'production'];

// Keys are written out as bare KEY=VALUE by export, and are passed to child
// processes as environment variable names. Anything outside the POSIX name
// shape either cannot be read back or is mangled by the consumer, so it is
// refused at the point it enters the vault rather than at each call site.
const VALID_SECRET_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertValidKey(key: string): void {
  if (!VALID_SECRET_KEY.test(key)) {
    throw new Error(
      `"${key}" is not a valid secret name. Use letters, digits, and underscores, starting with a letter or underscore.`,
    );
  }
}

function getProjectKey(identity: Identity): Buffer {
  const members = readMembers();
  const member = members.members[identity.fingerprint];
  if (!member) {
    throw new Error(
      `Identity ${identity.fingerprint} is not authorized on this project. Ask an existing member to run "fermer trust" with your public key.`,
    );
  }
  return unwrapProjectKey(member.wrappedKey, identity.privateKey);
}

export function initVault(identity: Identity): 'created' | 'updated' | 'unchanged' {
  const projectKey = randomKey(32);
  const wrappedKey = wrapProjectKey(projectKey, identity.publicKey);

  initializeFermerDir(
    { version: 1, environments: DEFAULT_ENVIRONMENTS, defaultEnvironment: DEFAULT_ENVIRONMENTS[0] },
    { version: 1, environments: {} },
    {
      version: 1,
      members: {
        [identity.fingerprint]: {
          publicKey: identity.publicKey,
          label: identity.label,
          wrappedKey,
          addedAt: new Date().toISOString(),
        },
      },
    },
  );

  return ensureGitAttributes();
}

export function setSecret(key: string, value: string, env: string, identity: Identity): void {
  assertValidKey(key);
  const projectKey = getProjectKey(identity);
  const vault = readVault();

  if (!vault.environments[env]) {
    vault.environments[env] = { secrets: {} };
  }

  const { iv, ciphertext, tag } = encryptAesGcm(Buffer.from(value, 'utf8'), projectKey);
  vault.environments[env].secrets[key] = { iv, ciphertext, tag, updatedAt: new Date().toISOString() };

  writeVault(vault);
}

export function unsetSecret(key: string, env: string, identity: Identity): void {
  getProjectKey(identity); // ensure this identity is authorized before mutating the vault
  const vault = readVault();

  if (!vault.environments[env]?.secrets[key]) {
    throw new Error(`Secret "${key}" not found in environment "${env}".`);
  }

  delete vault.environments[env].secrets[key];
  writeVault(vault);
}

export function listSecrets(env: string, identity: Identity): string[] {
  getProjectKey(identity); // ensure this identity is authorized before revealing key names
  const vault = readVault();
  return Object.keys(vault.environments[env]?.secrets ?? {});
}

export function getSecrets(env: string, identity: Identity): Record<string, string> {
  const projectKey = getProjectKey(identity);
  const vault = readVault();
  const secrets = vault.environments[env]?.secrets ?? {};

  const result: Record<string, string> = {};
  for (const [key, encrypted] of Object.entries(secrets)) {
    const plaintext = decryptAesGcm(encrypted.iv, encrypted.ciphertext, encrypted.tag, projectKey);
    result[key] = plaintext.toString('utf8');
  }
  return result;
}

export function trustMember(
  publicKeyPath: string,
  identity: Identity,
): { fingerprint: string; label: string } {
  const projectKey = getProjectKey(identity);
  const members = readMembers();

  const publicKey = canonicalizePublicKey(readFileSync(publicKeyPath, 'utf8'));
  const fingerprint = computeFingerprint(publicKey);

  if (members.members[fingerprint]) {
    throw new Error(`A member with fingerprint ${fingerprint} is already trusted.`);
  }

  const fileName = basename(publicKeyPath);
  const label = fileName.slice(0, fileName.length - extname(fileName).length) || fileName;

  const wrappedKey = wrapProjectKey(projectKey, publicKey);
  members.members[fingerprint] = {
    publicKey,
    label,
    wrappedKey,
    addedAt: new Date().toISOString(),
  };

  writeMembers(members);
  return { fingerprint, label };
}

export function revokeMember(fingerprint: string, identity: Identity): void {
  const oldProjectKey = getProjectKey(identity);
  const members = readMembers();

  if (!members.members[fingerprint]) {
    throw new Error(`No member with fingerprint ${fingerprint} is trusted on this project.`);
  }

  const remainingEntries = Object.entries(members.members).filter(([fp]) => fp !== fingerprint);
  if (remainingEntries.length === 0) {
    throw new Error('Cannot revoke the only remaining member of this project.');
  }

  const vault = readVault();
  const newProjectKey = randomKey(32);

  const newVault: VaultFile = { version: 1, environments: {} };
  for (const [env, { secrets }] of Object.entries(vault.environments)) {
    newVault.environments[env] = { secrets: {} };
    for (const [key, encrypted] of Object.entries(secrets)) {
      const plaintext = decryptAesGcm(encrypted.iv, encrypted.ciphertext, encrypted.tag, oldProjectKey);
      const reEncrypted = encryptAesGcm(plaintext, newProjectKey);
      // Rotation re-encrypts without changing any value, so the original
      // last-modified timestamp is carried over.
      newVault.environments[env].secrets[key] = { ...reEncrypted, updatedAt: encrypted.updatedAt };
    }
  }

  const newMembers: MembersFile = { version: 1, members: {} };
  for (const [fp, entry] of remainingEntries) {
    newMembers.members[fp] = {
      ...entry,
      wrappedKey: wrapProjectKey(newProjectKey, entry.publicKey),
    };
  }

  writeVaultAndMembers(newVault, newMembers);
}

export function listMembers(
  identity: Identity,
): Array<{ fingerprint: string; label: string; addedAt: string }> {
  getProjectKey(identity); // ensure this identity is authorized before revealing membership
  const members = readMembers();
  return Object.entries(members.members).map(([fingerprint, entry]) => ({
    fingerprint,
    label: entry.label,
    addedAt: entry.addedAt,
  }));
}
