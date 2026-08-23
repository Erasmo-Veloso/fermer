import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../src/identity/index';
import {
  initVault,
  setSecret,
  unsetSecret,
  listSecrets,
  getSecrets,
  addEnvironment,
  listEnvironments,
} from '../src/vault/index';
import { fermerDir } from '../src/vault/format';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-vault-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);

  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = mkdtempSync(join(tmpdir(), 'fermer-vault-home-'));
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('vault: init and secret CRUD', () => {
  it('init creates config, vault, and members files', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(existsSync(join(fermerDir(), 'config.json'))).toBe(true);
    expect(existsSync(join(fermerDir(), 'vault.json'))).toBe(true);
    expect(existsSync(join(fermerDir(), 'members.json'))).toBe(true);
  });

  it('init marks the vault files binary in .gitattributes', () => {
    const identity = createIdentity('alice@workstation');
    const result = initVault(identity);

    expect(result).toBe('created');
    const attributes = readFileSync(join(repoRoot, '.gitattributes'), 'utf8');
    expect(attributes).toContain('.fermer/vault.json merge=binary');
    expect(attributes).toContain('.fermer/members.json merge=binary');
  });

  it('appends to an existing .gitattributes without clobbering it', () => {
    writeFileSync(join(repoRoot, '.gitattributes'), '*.png binary\n', 'utf8');
    const identity = createIdentity('alice@workstation');

    const result = initVault(identity);

    expect(result).toBe('updated');
    const attributes = readFileSync(join(repoRoot, '.gitattributes'), 'utf8');
    expect(attributes).toContain('*.png binary');
    expect(attributes).toContain('.fermer/vault.json merge=binary');
  });

  it('adds a separating newline when the existing file lacks one', () => {
    writeFileSync(join(repoRoot, '.gitattributes'), '*.png binary', 'utf8');
    const identity = createIdentity('alice@workstation');

    initVault(identity);

    const lines = readFileSync(join(repoRoot, '.gitattributes'), 'utf8').split('\n');
    expect(lines).toContain('*.png binary');
    expect(lines).toContain('.fermer/vault.json merge=binary');
  });

  it('leaves no staging directory behind after init', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    const residue = readdirSync(repoRoot).filter((entry) => entry.startsWith('.fermer.init-'));
    expect(residue).toEqual([]);
  });

  it('refuses to init twice', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    expect(() => initVault(identity)).toThrow();
  });

  it('sets and gets a secret roundtrip', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('DATABASE_URL', 'postgres://localhost/db', 'development', identity);
    const secrets = getSecrets('development', identity);

    expect(secrets.DATABASE_URL).toBe('postgres://localhost/db');
  });

  it('overwrites an existing key on set', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('API_KEY', 'first', 'development', identity);
    setSecret('API_KEY', 'second', 'development', identity);

    const secrets = getSecrets('development', identity);
    expect(secrets.API_KEY).toBe('second');
  });

  it('removes a key on unset', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('TEMP', 'value', 'development', identity);
    unsetSecret('TEMP', 'development', identity);

    expect(listSecrets('development', identity)).not.toContain('TEMP');
  });

  it('throws when unsetting a key that does not exist', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(() => unsetSecret('MISSING', 'development', identity)).toThrow();
  });

  it('list returns only key names, not values', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('KEY_ONE', 'secret-value', 'development', identity);
    setSecret('KEY_TWO', 'another-secret', 'development', identity);

    const keys = listSecrets('development', identity);
    expect(keys.sort()).toEqual(['KEY_ONE', 'KEY_TWO']);
  });

  it('keeps environments isolated from each other', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('SHARED_NAME', 'dev-value', 'development', identity);
    setSecret('SHARED_NAME', 'prod-value', 'production', identity);

    expect(getSecrets('development', identity).SHARED_NAME).toBe('dev-value');
    expect(getSecrets('production', identity).SHARED_NAME).toBe('prod-value');
  });

  it('returns an empty list/object for an environment with no secrets', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(listSecrets('staging', identity)).toEqual([]);
    expect(getSecrets('staging', identity)).toEqual({});
  });

  it('rejects secret names that are not valid environment variable names', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(() => setSecret('MY KEY', 'v', 'development', identity)).toThrow(/not a valid secret name/);
    expect(() => setSecret('1STARTS_WITH_DIGIT', 'v', 'development', identity)).toThrow();
    expect(() => setSecret('HAS-DASH', 'v', 'development', identity)).toThrow();
    expect(() => setSecret('HAS\nNEWLINE', 'v', 'development', identity)).toThrow();
    expect(() => setSecret('', 'v', 'development', identity)).toThrow();
  });

  it('accepts conventional environment variable names', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    setSecret('DATABASE_URL', 'v', 'development', identity);
    setSecret('_PRIVATE', 'v', 'development', identity);
    setSecret('KEY2', 'v', 'development', identity);

    expect(listSecrets('development', identity).sort()).toEqual(['DATABASE_URL', 'KEY2', '_PRIVATE']);
  });

  it('refuses to touch an environment that is not in the config', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(() => setSecret('KEY', 'v', 'prodution', identity)).toThrow(/Unknown environment "prodution"/);
    expect(() => listSecrets('prodution', identity)).toThrow(/Unknown environment/);
    expect(() => getSecrets('prodution', identity)).toThrow(/Unknown environment/);
    expect(() => unsetSecret('KEY', 'prodution', identity)).toThrow(/Unknown environment/);
  });

  it('names the known environments when rejecting an unknown one', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(() => setSecret('KEY', 'v', 'typo', identity)).toThrow(/development, staging, production/);
  });

  it('adds a new environment on request and then accepts it', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(addEnvironment('preview', identity)).toBe(true);
    expect(listEnvironments()).toContain('preview');

    setSecret('KEY', 'v', 'preview', identity);
    expect(getSecrets('preview', identity).KEY).toBe('v');
  });

  it('reports that an already-known environment was not added', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(addEnvironment('staging', identity)).toBe(false);
    expect(listEnvironments().filter((e) => e === 'staging')).toHaveLength(1);
  });

  it('rejects an invalid environment name', () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    expect(() => addEnvironment('has space', identity)).toThrow(/not a valid environment name/);
    expect(() => addEnvironment('-leading-dash', identity)).toThrow();
    expect(() => addEnvironment('', identity)).toThrow();
  });

  it('fails all operations for an identity not present in members', () => {
    const owner = createIdentity('alice@workstation');
    initVault(owner);
    setSecret('KEY', 'value', 'development', owner);

    const strangerHome = mkdtempSync(join(tmpdir(), 'fermer-stranger-'));
    process.env.FERMER_HOME = strangerHome;
    const stranger = createIdentity('mallory@laptop');

    expect(() => getSecrets('development', stranger)).toThrow();
    expect(() => setSecret('KEY', 'x', 'development', stranger)).toThrow();
    expect(() => listSecrets('development', stranger)).toThrow();

    rmSync(strangerHome, { recursive: true, force: true });
  });
});
