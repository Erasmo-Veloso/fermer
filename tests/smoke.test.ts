import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(__dirname, '..');
const builtCli = join(projectRoot, 'dist', 'cli.js');

function runCli(args: string[], options: { cwd?: string; home?: string } = {}) {
  return spawnSync(process.execPath, [builtCli, ...args], {
    cwd: options.cwd ?? projectRoot,
    encoding: 'utf8',
    env: { ...process.env, FERMER_HOME: options.home ?? join(tmpdir(), 'fermer-smoke-unused-home') },
  });
}

beforeAll(() => {
  // The point of this suite is the shipped artifact, so it is built here rather
  // than assuming a previous build left a current dist/ behind.
  execFileSync('npm', ['run', 'build'], { cwd: projectRoot, stdio: 'pipe', shell: true });
}, 180_000);

describe('smoke: the built CLI', () => {
  it('produces dist/cli.js', () => {
    expect(existsSync(builtCli)).toBe(true);
  });

  it('prints usage and exits 0 for --help', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: fermer');
    expect(result.stdout).toContain('run <command...>');
  });

  it('prints usage when invoked with no arguments', () => {
    const result = runCli([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: fermer');
  });

  it('prints the version from package.json', () => {
    const { version } = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as { version: string };
    const result = runCli(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(version);
  });

  it('lists every documented command in the help output', () => {
    const help = runCli(['--help']).stdout;
    for (const command of [
      'identity',
      'init',
      'set',
      'unset',
      'list',
      'run',
      'export',
      'trust',
      'revoke',
      'members',
    ]) {
      expect(help).toContain(command);
    }
  });

  it('rejects an unknown command on stderr with exit 1', () => {
    const result = runCli(['not-a-command']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command');
    expect(result.stdout).toBe('');
  });

  it('reports a missing identity rather than crashing', () => {
    const emptyHome = mkdtempSync(join(tmpdir(), 'fermer-smoke-home-'));
    try {
      const result = runCli(['init'], { home: emptyHome });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('fermer identity');
    } finally {
      rmSync(emptyHome, { recursive: true, force: true });
    }
  });

  it('reports being outside a git repository', () => {
    const outside = mkdtempSync(join(tmpdir(), 'fermer-smoke-outside-'));
    const home = mkdtempSync(join(tmpdir(), 'fermer-smoke-outside-home-'));
    try {
      expect(runCli(['identity', 'smoke@test'], { cwd: outside, home }).status).toBe(0);
      const result = runCli(['init'], { cwd: outside, home });
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('git repository');
    } finally {
      rmSync(outside, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  it('runs a real init/set/run cycle end to end', () => {
    const repo = mkdtempSync(join(tmpdir(), 'fermer-smoke-repo-'));
    const home = mkdtempSync(join(tmpdir(), 'fermer-smoke-cycle-home-'));
    mkdirSync(join(repo, '.git'));
    try {
      expect(runCli(['identity', 'smoke@test'], { cwd: repo, home }).status).toBe(0);
      expect(runCli(['init'], { cwd: repo, home }).status).toBe(0);
      expect(runCli(['set', 'SMOKE_VALUE=it-works'], { cwd: repo, home }).status).toBe(0);

      const exported = runCli(['export'], { cwd: repo, home });
      expect(exported.status).toBe(0);
      expect(exported.stdout.trim()).toBe('SMOKE_VALUE=it-works');

      const ran = runCli(
        ['run', process.execPath, '-e', 'process.stdout.write(process.env.SMOKE_VALUE ?? "missing")'],
        { cwd: repo, home },
      );
      expect(ran.status).toBe(0);
      expect(ran.stdout).toContain('it-works');
    } finally {
      rmSync(repo, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });
});
