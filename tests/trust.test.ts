import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
