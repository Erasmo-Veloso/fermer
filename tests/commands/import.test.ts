import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../../src/identity/index';
import { initVault, setSecret, getSecrets, listSecrets } from '../../src/vault/index';
import { fermerDir } from '../../src/vault/format';
import { execute } from '../../src/commands/import';
import type { Identity } from '../../src/types';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let stdout: string[];
let identity: Identity;

function output(): string {
  return stdout.join('');
}

function writeEnv(contents: string, name = '.env'): void {
  writeFileSync(join(repoRoot, name), contents, 'utf8');
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-import-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = mkdtempSync(join(tmpdir(), 'fermer-import-home-'));

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

describe('command: import — the happy path', () => {
  it('imports every variable from .env by default', async () => {
    writeEnv('DATABASE_URL=postgres://localhost/db\nAPI_KEY=abc123\nPORT=3000\n');

    await execute([], { env: 'development' });

    expect(getSecrets('development', identity)).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      API_KEY: 'abc123',
      PORT: '3000',
    });
  });

  it('imports from a named file', async () => {
    writeEnv('TOKEN=t\n', '.env.production');

    await execute(['.env.production'], { env: 'production' });

    expect(getSecrets('production', identity)).toEqual({ TOKEN: 't' });
  });

  it('imports into the target environment only', async () => {
    writeEnv('TOKEN=prod-value\n');

    await execute([], { env: 'production' });

    expect(getSecrets('production', identity)).toEqual({ TOKEN: 'prod-value' });
    expect(getSecrets('development', identity)).toEqual({});
  });

  it('preserves a multi-line value through the import', async () => {
    writeEnv('PEM="-----BEGIN KEY-----\nbody\n-----END KEY-----"\n');

    await execute([], { env: 'development' });

    expect(getSecrets('development', identity).PEM).toBe('-----BEGIN KEY-----\nbody\n-----END KEY-----');
  });

  it('writes the vault once rather than once per variable', async () => {
    const manyVars = Array.from({ length: 25 }, (_, i) => `KEY_${i}=value${i}`).join('\n');
    writeEnv(manyVars);

    await execute([], { env: 'development' });

    expect(listSecrets('development', identity)).toHaveLength(25);
    const leftovers = readFileSync(join(fermerDir(), 'vault.json'), 'utf8');
    expect(leftovers).toContain('"version": 1');
  });
});

describe('command: import — leaves existing secrets alone', () => {
  it('skips a key that already exists and reports it', async () => {
    setSecret('DATABASE_URL', 'the-real-one', 'development', identity);
    writeEnv('DATABASE_URL=from-the-file\nNEW_KEY=new\n');

    await execute([], { env: 'development' });

    const secrets = getSecrets('development', identity);
    expect(secrets.DATABASE_URL).toBe('the-real-one');
    expect(secrets.NEW_KEY).toBe('new');
    expect(output()).toMatch(/skipped\s+1/);
    expect(output()).toContain('Left untouched: DATABASE_URL');
  });

  it('replaces existing keys only when --overwrite is given', async () => {
    setSecret('DATABASE_URL', 'the-old-one', 'development', identity);
    writeEnv('DATABASE_URL=from-the-file\n');

    await execute(['--overwrite'], { env: 'development' });

    expect(getSecrets('development', identity).DATABASE_URL).toBe('from-the-file');
    expect(output()).toMatch(/overwritten\s+1/);
  });

  it('writes nothing when every key already exists', async () => {
    setSecret('A', 'keep', 'development', identity);
    writeEnv('A=replace\n');

    await execute([], { env: 'development' });

    expect(getSecrets('development', identity)).toEqual({ A: 'keep' });
  });
});

describe('command: import — refuses anything ambiguous', () => {
  it('aborts on a duplicate key without importing anything', async () => {
    writeEnv('GOOD=1\nDUP=a\nDUP=b\n');

    await expect(execute([], { env: 'development' })).rejects.toThrow(/assigned more than once/);
    expect(listSecrets('development', identity)).toEqual([]);
  });

  it('aborts on a name fermer cannot store', async () => {
    writeEnv('GOOD=1\nMY-KEY=2\n2FA=3\n');

    await expect(execute([], { env: 'development' })).rejects.toThrow(/MY-KEY/);
    expect(listSecrets('development', identity)).toEqual([]);
  });

  it('aborts on a line that is not an assignment', async () => {
    writeEnv('GOOD=1\nthis is garbage\n');

    await expect(execute([], { env: 'development' })).rejects.toThrow(/not KEY=VALUE/);
    expect(listSecrets('development', identity)).toEqual([]);
  });

  it('aborts on an unterminated quote', async () => {
    writeEnv('GOOD=1\nBAD="never closed\n');

    await expect(execute([], { env: 'development' })).rejects.toThrow(/unclosed quote/);
    expect(listSecrets('development', identity)).toEqual([]);
  });

  it('reports every problem at once so the file can be fixed in one pass', async () => {
    writeEnv('DUP=a\nDUP=b\nMY-KEY=1\ngarbage line\n');

    const error = await execute([], { env: 'development' }).catch((e: Error) => e.message);

    expect(error).toContain('assigned more than once');
    expect(error).toContain('MY-KEY');
    expect(error).toContain('not KEY=VALUE');
    expect(error).toContain('Nothing was imported.');
  });

  it('refuses an unknown environment', async () => {
    writeEnv('KEY=value\n');
    await expect(execute([], { env: 'prodution' })).rejects.toThrow(/Unknown environment/);
  });

  it('reports a missing file clearly', async () => {
    await expect(execute(['nope.env'], { env: 'development' })).rejects.toThrow(/No file at nope.env/);
  });

  it('refuses a directory', async () => {
    mkdirSync(join(repoRoot, 'somedir'));
    await expect(execute(['somedir'], { env: 'development' })).rejects.toThrow(/is a directory/);
  });
});

describe('command: import — safety of the report', () => {
  it('never prints a secret value', async () => {
    writeEnv('DATABASE_URL=super-secret-value\nTOKEN=another-secret\n');

    await execute([], { env: 'development' });

    expect(output()).not.toContain('super-secret-value');
    expect(output()).not.toContain('another-secret');
    expect(output()).toContain('DATABASE_URL');
  });

  it('warns about a value that may contain an inline comment', async () => {
    writeEnv('PASSWORD=p@ss # maybe a comment\n');

    await execute([], { env: 'development' });

    expect(output()).toContain('" #"');
    expect(output()).toContain('PASSWORD');
    expect(getSecrets('development', identity).PASSWORD).toBe('p@ss # maybe a comment');
  });

  it('tells the user to gitignore the file when it is not ignored', async () => {
    writeEnv('KEY=value\n');

    await execute([], { env: 'development' });

    expect(output()).toContain('.gitignore');
  });

  it('does not nag about .gitignore when the file is already ignored', async () => {
    writeFileSync(join(repoRoot, '.gitignore'), 'node_modules/\n.env\n', 'utf8');
    writeEnv('KEY=value\n');

    await execute([], { env: 'development' });

    expect(output()).not.toContain('Add .env to .gitignore');
  });

  it('reminds the user the plaintext file still exists', async () => {
    writeEnv('KEY=value\n');

    await execute([], { env: 'development' });

    expect(output()).toContain('still holds these values in plaintext');
  });
});

describe('command: import — dry run', () => {
  it('reports what would happen and writes nothing', async () => {
    setSecret('EXISTING', 'keep', 'development', identity);
    writeEnv('EXISTING=replace\nNEW_ONE=value\n');

    await execute(['--dry-run'], { env: 'development' });

    expect(output()).toContain('would import');
    expect(output()).toContain('Dry run: nothing was written.');
    expect(listSecrets('development', identity)).toEqual(['EXISTING']);
  });

  it('still refuses an invalid file in a dry run', async () => {
    writeEnv('DUP=a\nDUP=b\n');
    await expect(execute(['--dry-run'], { env: 'development' })).rejects.toThrow();
  });
});

describe('command: import — nothing to do', () => {
  it('says so for a file with only comments', async () => {
    writeEnv('# just a comment\n\n');

    await execute([], { env: 'development' });

    expect(output()).toContain('defines no variables');
    expect(listSecrets('development', identity)).toEqual([]);
  });
});
