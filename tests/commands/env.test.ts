import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../../src/identity/index';
import {
  initVault,
  addEnvironment,
  getDefaultEnvironment,
  setDefaultEnvironment,
} from '../../src/vault/index';
import { execute } from '../../src/commands/env';
import type { Identity } from '../../src/types';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let stdout: string[];
let identity: Identity;

function output(): string {
  return stdout.join('');
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-env-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = mkdtempSync(join(tmpdir(), 'fermer-env-home-'));

  identity = createIdentity('alice@box');
  initVault(identity);

  stdout = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(repoRoot, { recursive: true, force: true });
});

describe('command: env — showing environments', () => {
  it('lists the environments a new project starts with', async () => {
    await execute([], { env: 'development' });

    expect(output()).toContain('development');
    expect(output()).toContain('staging');
    expect(output()).toContain('production');
  });

  it('marks which environment is the default and which is in use', async () => {
    await execute([], { env: 'staging' });

    expect(output()).toMatch(/development\s+\(default\)/);
    expect(output()).toMatch(/staging\s+\(in use\)/);
  });

  it('marks a single environment as both when they coincide', async () => {
    await execute([], { env: 'development' });

    expect(output()).toMatch(/development\s+\(default, in use\)/);
  });

  it('reports structured output with --json', async () => {
    await execute(['--json'], { env: 'production' });

    expect(JSON.parse(output())).toEqual({
      environments: ['development', 'staging', 'production'],
      default: 'development',
      current: 'production',
    });
  });

  it('includes an environment added later', async () => {
    addEnvironment('preview', identity);

    await execute(['--json'], { env: 'development' });

    expect(JSON.parse(output()).environments).toContain('preview');
  });
});

describe('command: env — changing the default', () => {
  it('makes the named environment the default', async () => {
    await execute(['production'], { env: 'development' });

    expect(getDefaultEnvironment()).toBe('production');
    expect(output()).toContain('Default environment is now production');
  });

  it('says so when the environment is already the default', async () => {
    await execute(['development'], { env: 'development' });

    expect(output()).toContain('already development');
  });

  it('refuses an environment the project does not have', async () => {
    await expect(execute(['prodution'], { env: 'development' })).rejects.toThrow(
      /Unknown environment "prodution"/,
    );
    expect(getDefaultEnvironment()).toBe('development');
  });

  it('names the known environments when refusing', async () => {
    await expect(execute(['nope'], { env: 'development' })).rejects.toThrow(
      /development, staging, production/,
    );
  });

  it('reminds the user to commit the change', async () => {
    await execute(['staging'], { env: 'development' });

    expect(output()).toContain('config.json');
  });
});

describe('vault: default environment', () => {
  it('starts as development', () => {
    expect(getDefaultEnvironment()).toBe('development');
  });

  it('reports whether the write actually changed anything', () => {
    expect(setDefaultEnvironment('staging', identity)).toBe(true);
    expect(setDefaultEnvironment('staging', identity)).toBe(false);
  });

  it('refuses a change from an identity that is not a member', () => {
    const strangerHome = mkdtempSync(join(tmpdir(), 'fermer-env-stranger-'));
    process.env.FERMER_HOME = strangerHome;
    const stranger = createIdentity('mallory@box');

    expect(() => setDefaultEnvironment('production', stranger)).toThrow(/not authorized/);

    rmSync(strangerHome, { recursive: true, force: true });
  });
});
