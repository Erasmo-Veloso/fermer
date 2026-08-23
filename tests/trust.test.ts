import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../src/identity/index';
import {
  initVault,
  setSecret,
  getSecrets,
  trustMember,
  revokeMember,
  listMembers,
} from '../src/vault/index';
import { fermerDir } from '../src/vault/format';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let aliceHome: string;

function switchHome(home: string) {
  process.env.FERMER_HOME = home;
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-trust-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);

  originalHome = process.env.FERMER_HOME;
  aliceHome = mkdtempSync(join(tmpdir(), 'fermer-trust-alice-'));
  switchHome(aliceHome);
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(repoRoot, { recursive: true, force: true });
  rmSync(aliceHome, { recursive: true, force: true });
});

describe('vault: trust and revocation', () => {
  it('trust adds a member who can then decrypt secrets', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);
    setSecret('DATABASE_URL', 'postgres://localhost/db', 'development', alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-bob-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    const result = trustMember(bobPubPath, alice);
    expect(result.fingerprint).toBe(bob.fingerprint);
    expect(result.label).toBe('bob');

    switchHome(bobHome);
    const secrets = getSecrets('development', bob);
    expect(secrets.DATABASE_URL).toBe('postgres://localhost/db');

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('rejects trusting the same public key twice', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-bob2-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    trustMember(bobPubPath, alice);
    expect(() => trustMember(bobPubPath, alice)).toThrow();

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('revoke removes a member and rotates the project key', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);
    setSecret('API_KEY', 'super-secret', 'development', alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-bob3-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    trustMember(bobPubPath, alice);

    switchHome(bobHome);
    expect(getSecrets('development', bob).API_KEY).toBe('super-secret');

    switchHome(aliceHome);
    revokeMember(bob.fingerprint, alice);

    const members = listMembers(alice);
    expect(members.map((m) => m.fingerprint)).not.toContain(bob.fingerprint);

    switchHome(bobHome);
    expect(() => getSecrets('development', bob)).toThrow();

    switchHome(aliceHome);
    expect(getSecrets('development', alice).API_KEY).toBe('super-secret');

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('refuses to revoke the only remaining member', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    expect(() => revokeMember(alice.fingerprint, alice)).toThrow();
  });

  it('throws when revoking a fingerprint that is not a member', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    expect(() => revokeMember('0'.repeat(64), alice)).toThrow();
  });

  it('refuses a file containing a private key instead of a public key', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    const leakPath = join(aliceHome, 'oops.pub');
    writeFileSync(leakPath, alice.privateKey, 'utf8');

    expect(() => trustMember(leakPath, alice)).toThrow(/private key/i);

    const stored = readFileSync(join(fermerDir(), 'members.json'), 'utf8');
    expect(stored).not.toContain('PRIVATE KEY');
  });

  it('trusts a public key whose line endings were rewritten in transit', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);
    setSecret('TOKEN', 'abc123', 'development', alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-crlf-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey.replace(/\n/g, '\r\n'), 'utf8');

    switchHome(aliceHome);
    const result = trustMember(bobPubPath, alice);
    expect(result.fingerprint).toBe(bob.fingerprint);

    switchHome(bobHome);
    expect(getSecrets('development', bob).TOKEN).toBe('abc123');

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('refuses a key on the wrong curve', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    const { publicKey } = generateKeyPairSync('ec', {
      namedCurve: 'secp384r1',
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    const wrongCurvePath = join(aliceHome, 'wrong-curve.pub');
    writeFileSync(wrongCurvePath, publicKey, 'utf8');

    expect(() => trustMember(wrongCurvePath, alice)).toThrow(/P-256/);
  });

  it('refuses a file that is not a key at all', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    const garbagePath = join(aliceHome, 'garbage.pub');
    writeFileSync(garbagePath, 'this is not a key\n', 'utf8');

    expect(() => trustMember(garbagePath, alice)).toThrow(/not a valid public key/i);
  });

  it('preserves secret timestamps across key rotation', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);
    setSecret('API_KEY', 'value', 'development', alice);

    const before = JSON.parse(readFileSync(join(fermerDir(), 'vault.json'), 'utf8'));
    const originalUpdatedAt = before.environments.development.secrets.API_KEY.updatedAt;

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-ts-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    trustMember(bobPubPath, alice);
    revokeMember(bob.fingerprint, alice);

    const after = JSON.parse(readFileSync(join(fermerDir(), 'vault.json'), 'utf8'));
    expect(after.environments.development.secrets.API_KEY.updatedAt).toBe(originalUpdatedAt);
    expect(after.environments.development.secrets.API_KEY.ciphertext).not.toBe(
      before.environments.development.secrets.API_KEY.ciphertext,
    );

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('leaves no temp files behind after rotation', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);
    setSecret('KEY', 'value', 'development', alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-tmp-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    trustMember(bobPubPath, alice);
    revokeMember(bob.fingerprint, alice);

    const leftovers = readdirSync(fermerDir()).filter((f) => f.includes('.tmp'));
    expect(leftovers).toEqual([]);

    rmSync(bobHome, { recursive: true, force: true });
  });

  it('lists all trusted members with the current identity included', () => {
    const alice = createIdentity('alice@workstation');
    initVault(alice);

    const bobHome = mkdtempSync(join(tmpdir(), 'fermer-trust-bob4-'));
    switchHome(bobHome);
    const bob = createIdentity('bob@laptop');
    const bobPubPath = join(bobHome, 'bob.pub');
    writeFileSync(bobPubPath, bob.publicKey, 'utf8');

    switchHome(aliceHome);
    trustMember(bobPubPath, alice);

    const members = listMembers(alice);
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.fingerprint).sort()).toEqual(
      [alice.fingerprint, bob.fingerprint].sort(),
    );

    rmSync(bobHome, { recursive: true, force: true });
  });
});
