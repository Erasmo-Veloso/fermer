import { randomKey, encryptAesGcm, decryptAesGcm } from '../crypto/index.js';
import { wrapProjectKey, unwrapProjectKey } from '../crypto/wrap.js';
import { computeFingerprint, canonicalizePublicKey } from '../crypto/device.js';
import {
  readConfig,
  writeConfig,
  readVault,
  readLegacyMembers,
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
import { signMemberEntry } from './attest.js';

const DEFAULT_ENVIRONMENTS = ['development', 'staging', 'production'];

// Keys are written out as bare KEY=VALUE by export, and are passed to child
// processes as environment variable names. Anything outside the POSIX name
// shape either cannot be read back or is mangled by the consumer, so it is
// refused at the point it enters the vault rather than at each call site.
const VALID_SECRET_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

const VALID_ENVIRONMENT_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

function assertValidKey(key: string): void {
  if (!VALID_SECRET_KEY.test(key)) {
    throw new Error(
      `"${key}" is not a valid secret name. Use letters, digits, and underscores, starting with a letter or underscore.`,
    );
  }
}

// Without this check a typo in -e silently creates a parallel environment:
// "fermer set X=1 -e prodution" would succeed, and the secret would simply not
// be there when production is read. Adding an environment is now something the
// user has to ask for.
function assertKnownEnvironment(env: string): void {
  const config = readConfig();
  if (!config.environments.includes(env)) {
    throw new Error(
      `Unknown environment "${env}". Known: ${config.environments.join(', ')}. Add it with "fermer set KEY=VALUE -e ${env} --new-env".`,
    );
  }
}

export function addEnvironment(name: string, identity: Identity): boolean {
  getProjectKey(identity);
  if (!VALID_ENVIRONMENT_NAME.test(name)) {
    throw new Error(
      `"${name}" is not a valid environment name. Use letters, digits, dashes, and underscores.`,
    );
  }

  const config = readConfig();
  if (config.environments.includes(name)) {
    return false;
  }
  writeConfig({ ...config, environments: [...config.environments, name] });
  return true;
}

export function listEnvironments(): string[] {
  return readConfig().environments;
}

// Unwrapping a wrapped key only proves it was wrapped for this identity's public
// key, which anyone can do for themselves with a key of their own choosing.
// Decrypting a stored secret is what proves the unwrapped key is the project's,
// because AES-GCM authenticates it.
function assertIsProjectKey(candidate: Buffer): void {
  const vault = readVault();
  for (const { secrets } of Object.values(vault.environments)) {
    for (const value of Object.values(secrets)) {
      try {
        decryptAesGcm(value.iv, value.ciphertext, value.tag, candidate);
        return;
      } catch {
        throw new Error(
          'Your entry in the member list does not hold this project\'s key, so it cannot have been created by "fermer trust". Ask a current member to add you properly.',
        );
      }
    }
  }
  // An empty vault offers nothing to authenticate against. There are no secrets
  // to protect at this moment, and the caller is still required to be listed.
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

  // The founder attests themselves, which is the single root the whole member
  // chain is verified against.
  const founder = signMemberEntry(
    identity.fingerprint,
    {
      publicKey: identity.publicKey,
      label: identity.label,
      wrappedKey,
      addedAt: new Date().toISOString(),
      addedBy: identity.fingerprint,
    },
    identity,
  );

  initializeFermerDir(
    { version: 1, environments: DEFAULT_ENVIRONMENTS, defaultEnvironment: DEFAULT_ENVIRONMENTS[0] },
    { version: 1, environments: {} },
    { version: 2, members: { [identity.fingerprint]: founder } },
  );

  return ensureGitAttributes();
}

export function setSecret(key: string, value: string, env: string, identity: Identity): void {
  assertValidKey(key);
  assertKnownEnvironment(env);
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
  assertKnownEnvironment(env);
  getProjectKey(identity); // ensure this identity is authorized before mutating the vault
  const vault = readVault();

  if (!vault.environments[env]?.secrets[key]) {
    throw new Error(`Secret "${key}" not found in environment "${env}".`);
  }

  delete vault.environments[env].secrets[key];
  writeVault(vault);
}

export function listSecrets(env: string, identity: Identity): string[] {
  assertKnownEnvironment(env);
  getProjectKey(identity); // ensure this identity is authorized before revealing key names
  const vault = readVault();
  return Object.keys(vault.environments[env]?.secrets ?? {});
}

export function getSecrets(env: string, identity: Identity): Record<string, string> {
  assertKnownEnvironment(env);
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

  members.members[fingerprint] = signMemberEntry(
    fingerprint,
    {
      publicKey,
      label,
      wrappedKey: wrapProjectKey(projectKey, publicKey),
      addedAt: new Date().toISOString(),
      addedBy: identity.fingerprint,
    },
    identity,
  );

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

  // Only the founder's entry attests itself, and that self-attestation is the
  // root every other member is verified against. Revoking yourself as founder
  // would leave the others with no root, and you cannot self-attest on their
  // behalf without their private key.
  const revokedIsRoot = members.members[fingerprint].addedBy === fingerprint;
  if (revokedIsRoot && fingerprint === identity.fingerprint) {
    throw new Error(
      'You are the project founder, so you cannot revoke yourself: the remaining members would be left with no attestation root. Ask another member to revoke you, and they become the new root.',
    );
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

  const remainingFingerprints = new Set(remainingEntries.map(([fp]) => fp));
  const newMembers: MembersFile = { version: 2, members: {} };

  for (const [fp, entry] of remainingEntries) {
    // Removing a member breaks the attestation chain for everyone they vouched
    // for, and removes the root outright if they were the founder. The revoker
    // had to unwrap the project key to get here, which proves they are a real
    // member, so they re-attest the grants that are being kept. Entries whose
    // attester is untouched keep their original signature, since the signature
    // does not cover the wrapped key that rotation replaces.
    const attesterRemoved = !remainingFingerprints.has(entry.addedBy);
    const becomesRoot = revokedIsRoot && fp === identity.fingerprint;
    const addedBy = attesterRemoved || becomesRoot ? identity.fingerprint : entry.addedBy;

    const base = {
      publicKey: entry.publicKey,
      label: entry.label,
      wrappedKey: wrapProjectKey(newProjectKey, entry.publicKey),
      addedAt: entry.addedAt,
      addedBy,
    };

    newMembers.members[fp] =
      addedBy === entry.addedBy && !becomesRoot
        ? { ...base, signature: entry.signature }
        : signMemberEntry(fp, base, identity);
  }

  writeVaultAndMembers(newVault, newMembers);
}

// Upgrading an unsigned version 1 file means someone has to vouch for the
// members it already lists, because nothing in that format records who added
// whom. The caller becomes the root and attests everyone, so this must only run
// after a human has reviewed the list -- which is why it is a separate command
// rather than an automatic upgrade on first write.
export function migrateMembers(identity: Identity): Array<{ fingerprint: string; label: string }> {
  const legacy = readLegacyMembers();
  const own = legacy.members[identity.fingerprint];
  if (!own) {
    throw new Error(
      `Your identity ${identity.fingerprint} is not in this project's member list, so you cannot vouch for it. Ask a current member to run "fermer migrate".`,
    );
  }
  assertIsProjectKey(unwrapProjectKey(own.wrappedKey, identity.privateKey));

  const migrated: MembersFile = { version: 2, members: {} };
  for (const [fingerprint, entry] of Object.entries(legacy.members)) {
    migrated.members[fingerprint] = signMemberEntry(
      fingerprint,
      { ...entry, addedBy: identity.fingerprint },
      identity,
    );
  }

  writeMembers(migrated);
  return Object.entries(migrated.members).map(([fingerprint, entry]) => ({
    fingerprint,
    label: entry.label,
  }));
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
