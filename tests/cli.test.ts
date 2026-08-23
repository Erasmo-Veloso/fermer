import { describe, it, expect } from 'vitest';
import { extractEnv, COMMANDS, readVersion } from '../src/cli-args';

describe('cli: extractEnv', () => {
  it('defaults to development when no env flag is given', () => {
    const { env, rest } = extractEnv(['KEY=VALUE'], { leadingOnly: false });
    expect(env).toBe('development');
    expect(rest).toEqual(['KEY=VALUE']);
  });

  it('extracts -e from anywhere for non-run commands', () => {
    const { env, rest } = extractEnv(['KEY=VALUE', '-e', 'production'], { leadingOnly: false });
    expect(env).toBe('production');
    expect(rest).toEqual(['KEY=VALUE']);
  });

  it('extracts --env from the front for non-run commands', () => {
    const { env, rest } = extractEnv(['--env', 'staging', 'KEY=VALUE'], { leadingOnly: false });
    expect(env).toBe('staging');
    expect(rest).toEqual(['KEY=VALUE']);
  });

  it('throws when -e is given with no value', () => {
    expect(() => extractEnv(['-e'], { leadingOnly: false })).toThrow(/requires a value/);
  });

  it('run: extracts a leading -e before the child command', () => {
    const { env, rest } = extractEnv(['-e', 'production', 'npm', 'start'], { leadingOnly: true });
    expect(env).toBe('production');
    expect(rest).toEqual(['npm', 'start']);
  });

  it('run: does not swallow the child command\'s own -e flag', () => {
    const { env, rest } = extractEnv(['node', '-e', "console.log('hi')"], { leadingOnly: true });
    expect(env).toBe('development');
    expect(rest).toEqual(['node', '-e', "console.log('hi')"]);
  });

  it('run: does not swallow -e appearing after the child command name', () => {
    const { env, rest } = extractEnv(['npm', 'start', '-e', 'weird'], { leadingOnly: true });
    expect(env).toBe('development');
    expect(rest).toEqual(['npm', 'start', '-e', 'weird']);
  });
});

describe('cli: command table and version', () => {
  it('lists exactly the ten documented commands', () => {
    expect([...COMMANDS].sort()).toEqual(
      ['export', 'identity', 'init', 'list', 'members', 'revoke', 'run', 'set', 'trust', 'unset'].sort(),
    );
  });

  it('reads the version from package.json', () => {
    expect(readVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
