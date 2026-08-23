import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  identityDir,
  identityPath,
  identityExists,
  loadIdentity,
  createIdentity,
  exportPublicKey,
} from '../src/identity/index';

let tempHome: string;
let originalHome: string | undefined;

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'fermer-identity-'));
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = tempHome;
});

afterEach(() => {
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(tempHome, { recursive: true, force: true });
});

describe('identity: creation and loading', () => {
  it('reports no identity before one is created', () => {
    expect(identityExists()).toBe(false);
  });

  it('respects FERMER_HOME for identityDir and identityPath', () => {
    expect(identityDir()).toBe(tempHome);
    expect(identityPath()).toBe(join(tempHome, 'identity.json'));
  });

  it('creates an identity and writes it to disk as valid JSON', () => {
    const identity = createIdentity('alice@workstation');

    expect(identityExists()).toBe(true);
    expect(identity.label).toBe('alice@workstation');
    expect(identity.publicKey).toContain('BEGIN PUBLIC KEY');
    expect(identity.privateKey).toContain('BEGIN PRIVATE KEY');
    expect(identity.fingerprint).toMatch(/^[0-9a-f]{64}$/);

    const raw = readFileSync(identityPath(), 'utf8');
    const parsed = JSON.parse(raw);
    expect(parsed.fingerprint).toBe(identity.fingerprint);
  });

  it('loads back the same identity that was created', () => {
    const created = createIdentity('bob@laptop');
    const loaded = loadIdentity();

    expect(loaded).toEqual(created);
  });

  it('refuses to create a second identity over an existing one', () => {
    createIdentity('alice@workstation');
    expect(() => createIdentity('alice@other-machine')).toThrow();
  });

  it('throws a clear error when loading with no identity present', () => {
    expect(() => loadIdentity()).toThrow(/fermer identity/);
  });

  it('exports just the public key PEM to a file', () => {
    const identity = createIdentity('alice@workstation');
    const outPath = join(tempHome, 'alice.pub');

    exportPublicKey(outPath);

    const exported = readFileSync(outPath, 'utf8');
    expect(exported).toBe(identity.publicKey);
    expect(exported).not.toContain('PRIVATE KEY');
  });
});
