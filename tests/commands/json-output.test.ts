import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../../src/identity/index';
import { initVault, setSecret } from '../../src/vault/index';
import * as listCmd from '../../src/commands/list';
import * as membersCmd from '../../src/commands/members';
import * as exportCmd from '../../src/commands/export';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let stdout: string[];

function output(): string {
  return stdout.join('');
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-json-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = mkdtempSync(join(tmpdir(), 'fermer-json-home-'));
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

describe('--json output', () => {
  it('list --json emits a sorted array of key names', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('ZEBRA', 'z', 'development', identity);
    setSecret('ALPHA', 'a', 'development', identity);

    await listCmd.execute(['--json'], { env: 'development' });

    expect(JSON.parse(output())).toEqual(['ALPHA', 'ZEBRA']);
  });

  it('list --json emits an empty array rather than a prose message', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    await listCmd.execute(['--json'], { env: 'development' });

    expect(JSON.parse(output())).toEqual([]);
  });

  it('export --json round-trips a value containing a newline', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('PEM', 'line1\nline2', 'development', identity);

    await exportCmd.execute(['--json'], { env: 'development' });

    expect(JSON.parse(output())).toEqual({ PEM: 'line1\nline2' });
  });

  it('export --json emits keys in sorted order', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('ZEBRA', 'z', 'development', identity);
    setSecret('ALPHA', 'a', 'development', identity);

    await exportCmd.execute(['--json'], { env: 'development' });

    expect(Object.keys(JSON.parse(output()))).toEqual(['ALPHA', 'ZEBRA']);
  });

  it('members --json marks the calling identity', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);

    await membersCmd.execute(['--json'], { env: 'development' });

    const parsed = JSON.parse(output());
    expect(parsed).toHaveLength(1);
    expect(parsed[0].fingerprint).toBe(identity.fingerprint);
    expect(parsed[0].isSelf).toBe(true);
  });

  it('plain output is unchanged when --json is absent', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('ALPHA', 'a', 'development', identity);

    await listCmd.execute([], { env: 'development' });

    expect(output()).toBe('ALPHA\n');
  });
});
