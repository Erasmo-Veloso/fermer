import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execute } from '../../src/commands/identity';
import { loadIdentity } from '../../src/identity/index';

let tempHome: string;
let originalHome: string | undefined;
let stdout: string[];

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), 'fermer-cmd-identity-'));
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = tempHome;
  stdout = [];
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
    stdout.push(String(chunk));
    return true;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(tempHome, { recursive: true, force: true });
});

describe('command: identity', () => {
  it('creates an identity with a positional label when none exists', async () => {
    await execute(['alice@workstation'], { env: 'development' });

    const identity = loadIdentity();
    expect(identity.label).toBe('alice@workstation');
    expect(stdout.join('')).toContain('Identity created.');
  });

  it('shows the existing identity on a second call instead of recreating it', async () => {
    await execute(['alice@workstation'], { env: 'development' });
    stdout.length = 0;

    await execute([], { env: 'development' });

    expect(stdout.join('')).toContain('Identity:');
    expect(stdout.join('')).not.toContain('Identity created.');
  });

  it('creates and exports the public key in a single call', async () => {
    const outPath = join(tempHome, 'bob.pub');

    await execute(['bob@laptop', '--export', outPath], { env: 'development' });

    expect(existsSync(outPath)).toBe(true);
    const identity = loadIdentity();
    expect(identity.label).toBe('bob@laptop');
    expect(readFileSync(outPath, 'utf8')).toBe(identity.publicKey);
  });

  it('exports the public key for an already-existing identity', async () => {
    await execute(['alice@workstation'], { env: 'development' });
    const outPath = join(tempHome, 'alice.pub');

    await execute(['--export', outPath], { env: 'development' });

    const identity = loadIdentity();
    expect(readFileSync(outPath, 'utf8')).toBe(identity.publicKey);
  });

  it('throws when --export is given without a path', async () => {
    await expect(execute(['--export'], { env: 'development' })).rejects.toThrow(/requires a file path/);
  });
});
