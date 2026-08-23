import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig, readVault, readMembers, writeVault, fermerDir } from '../src/vault/format';

let repoRoot: string;
let originalCwd: string;

function writeFermerFile(name: string, contents: unknown): void {
  mkdirSync(fermerDir(), { recursive: true });
  const body = typeof contents === 'string' ? contents : JSON.stringify(contents, null, 2);
  writeFileSync(join(fermerDir(), name), body, 'utf8');
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-format-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('format: missing file messages', () => {
  it('tells the user to run init when .fermer/ does not exist', () => {
    expect(() => readVault()).toThrow(/No \.fermer\/ directory/);
    expect(() => readVault()).toThrow(/fermer init/);
  });

  it('does not suggest init when .fermer/ exists but a file is missing', () => {
    writeFermerFile('config.json', { version: 1, environments: ['development'], defaultEnvironment: 'development' });

    expect(() => readVault()).toThrow(/vault is incomplete/);
    expect(() => readVault()).not.toThrow(/fermer init/);
  });
});

describe('format: version validation', () => {
  it('rejects a future version with an upgrade hint', () => {
    writeFermerFile('vault.json', { version: 2, environments: {} });
    expect(() => readVault()).toThrow(/only understands version 1/);
  });

  it('rejects a missing version field', () => {
    writeFermerFile('vault.json', { environments: {} });
    expect(() => readVault()).toThrow(/version undefined/);
  });
});

describe('format: concurrent write detection', () => {
  const wellFormedVault = {
    version: 1,
    environments: { development: { secrets: {} } },
  };

  it('refuses to write when the file changed after it was read', () => {
    writeFermerFile('vault.json', wellFormedVault);
    const vault = readVault();

    // Someone else's command lands between our read and our write.
    writeFermerFile('vault.json', {
      version: 1,
      environments: { development: { secrets: { THEIRS: { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' } } } },
    });

    vault.environments.development.secrets.MINE = { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' };
    expect(() => writeVault(vault)).toThrow(/changed on disk/);
  });

  it('does not lose the other change when it refuses', () => {
    writeFermerFile('vault.json', wellFormedVault);
    const vault = readVault();
    writeFermerFile('vault.json', {
      version: 1,
      environments: { development: { secrets: { THEIRS: { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' } } } },
    });

    expect(() => writeVault(vault)).toThrow();
    expect(Object.keys(readVault().environments.development.secrets)).toEqual(['THEIRS']);
  });

  it('allows a normal read-modify-write', () => {
    writeFermerFile('vault.json', wellFormedVault);
    const vault = readVault();

    vault.environments.development.secrets.MINE = { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' };
    writeVault(vault);

    expect(Object.keys(readVault().environments.development.secrets)).toEqual(['MINE']);
  });

  it('allows two successive writes in the same command', () => {
    writeFermerFile('vault.json', wellFormedVault);
    const vault = readVault();

    vault.environments.development.secrets.FIRST = { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' };
    writeVault(vault);
    vault.environments.development.secrets.SECOND = { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' };
    writeVault(vault);

    expect(Object.keys(readVault().environments.development.secrets).sort()).toEqual(['FIRST', 'SECOND']);
  });

  it('refuses to write when the file was deleted after it was read', () => {
    writeFermerFile('vault.json', wellFormedVault);
    const vault = readVault();
    rmSync(join(fermerDir(), 'vault.json'));

    expect(() => writeVault(vault)).toThrow(/changed on disk/);
  });
});

describe('format: structural validation', () => {
  it('rejects invalid JSON', () => {
    writeFermerFile('vault.json', '{ not json');
    expect(() => readVault()).toThrow(/not valid JSON/);
  });

  it('rejects a vault whose environments is not an object', () => {
    writeFermerFile('vault.json', { version: 1, environments: [] });
    expect(() => readVault()).toThrow(/"environments" must be an object/);
  });

  it('rejects an environment without a secrets object', () => {
    writeFermerFile('vault.json', { version: 1, environments: { development: {} } });
    expect(() => readVault()).toThrow(/must have a "secrets" object/);
  });

  it('rejects a secret missing its authentication tag', () => {
    writeFermerFile('vault.json', {
      version: 1,
      environments: { development: { secrets: { A: { iv: 'i', ciphertext: 'c' } } } },
    });
    expect(() => readVault()).toThrow(/secret "A" in "development".*"tag"/);
  });

  it('rejects a config whose environments contains a non-string', () => {
    writeFermerFile('config.json', { version: 1, environments: ['development', 7], defaultEnvironment: 'development' });
    expect(() => readConfig()).toThrow(/array of strings/);
  });

  it('rejects a config without a default environment', () => {
    writeFermerFile('config.json', { version: 1, environments: ['development'] });
    expect(() => readConfig()).toThrow(/"defaultEnvironment" must be a string/);
  });

  it('rejects a member missing its public key', () => {
    writeFermerFile('members.json', {
      version: 1,
      members: { abc: { label: 'x', addedAt: 'now', wrappedKey: { ephemeralPublicKey: 'e', iv: 'i', ciphertext: 'c', tag: 't' } } },
    });
    expect(() => readMembers()).toThrow(/"publicKey"/);
  });

  it('rejects a member whose wrappedKey has no ephemeral public key', () => {
    writeFermerFile('members.json', {
      version: 1,
      members: { abc: { publicKey: 'p', label: 'x', addedAt: 'now', wrappedKey: { iv: 'i', ciphertext: 'c', tag: 't' } } },
    });
    expect(() => readMembers()).toThrow(/"ephemeralPublicKey"/);
  });

  it('accepts a well-formed vault', () => {
    writeFermerFile('vault.json', {
      version: 1,
      environments: { development: { secrets: { A: { iv: 'i', ciphertext: 'c', tag: 't', updatedAt: 'now' } } } },
    });
    expect(readVault().environments.development.secrets.A.ciphertext).toBe('c');
  });
});
