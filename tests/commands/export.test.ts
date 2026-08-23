import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../../src/identity/index';
import { initVault, setSecret } from '../../src/vault/index';
import { execute, formatValue } from '../../src/commands/export';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let stdout: string[];

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-cmd-export-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;
  process.env.FERMER_HOME = mkdtempSync(join(tmpdir(), 'fermer-cmd-export-home-'));
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

describe('command: export — value formatting', () => {
  it('emits simple values bare', () => {
    expect(formatValue('postgres://localhost/db')).toBe('postgres://localhost/db');
  });

  it('quotes and escapes a value containing a newline', () => {
    expect(formatValue('line1\nline2')).toBe('"line1\\nline2"');
  });

  it('quotes and escapes embedded quotes and backslashes', () => {
    expect(formatValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(formatValue('C:\\path')).toBe('"C:\\\\path"');
  });

  it('quotes values with leading or trailing whitespace so it survives', () => {
    expect(formatValue(' padded ')).toBe('" padded "');
  });
});

describe('command: export — output', () => {
  it('cannot smuggle an extra variable through a newline in a value', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('MULTILINE', 'line1\nINJECTED_VAR=pwned', 'development', identity);

    await execute([], { env: 'development' });

    const varNames = stdout
      .join('')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.slice(0, line.indexOf('=')));

    expect(varNames).toEqual(['MULTILINE']);
    expect(varNames).not.toContain('INJECTED_VAR');
  });

  it('emits keys in sorted order for stable diffs', async () => {
    const identity = createIdentity('alice@workstation');
    initVault(identity);
    setSecret('ZEBRA', 'z', 'development', identity);
    setSecret('ALPHA', 'a', 'development', identity);
    setSecret('MIDDLE', 'm', 'development', identity);

    await execute([], { env: 'development' });

    const varNames = stdout
      .join('')
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => line.slice(0, line.indexOf('=')));

    expect(varNames).toEqual(['ALPHA', 'MIDDLE', 'ZEBRA']);
  });
});
