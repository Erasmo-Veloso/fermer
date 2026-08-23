import { randomKey, encryptAesGcm, decryptAesGcm } from '../crypto/index.js';
import { wrapProjectKey, unwrapProjectKey } from '../crypto/wrap.js';
import { fermerDir, writeConfig, readVault, writeVault, readMembers, writeMembers } from './format.js';
import { existsSync } from 'node:fs';
import type { Identity, VaultFile } from '../types.js';

const DEFAULT_ENVIRONMENTS = ['development', 'staging', 'production'];

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

export function initVault(identity: Identity): void {
  if (existsSync(fermerDir())) {
    throw new Error(`Fermer is already initialized at ${fermerDir()}.`);
  }

  const projectKey = randomKey(32);

  writeConfig({
    version: 1,
    environments: DEFAULT_ENVIRONMENTS,
    defaultEnvironment: 'development',
  });

  const vault: VaultFile = { version: 1, environments: {} };
  writeVault(vault);

  const wrappedKey = wrapProjectKey(projectKey, identity.publicKey);
  writeMembers({
    version: 1,
    members: {
      [identity.fingerprint]: {
        publicKey: identity.publicKey,
        label: identity.label,
        wrappedKey,
        addedAt: new Date().toISOString(),
      },
    },
  });
}

export function setSecret(key: string, value: string, env: string, identity: Identity): void {
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
