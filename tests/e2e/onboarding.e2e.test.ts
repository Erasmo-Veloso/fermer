import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cliEntry = join(repoRoot, 'apps', 'cli', 'src', 'index.js');

describe('onboarding e2e', () => {
  it('initializes, links, and runs a command with injected secrets', () => {
    const tempRepo = mkdtempSync(join(tmpdir(), 'fermer-e2e-repo-'));
    const tempHome = mkdtempSync(join(tmpdir(), 'fermer-e2e-home-'));
    const fermerDir = join(tempHome, '.fermer');

    mkdirSync(join(tempRepo, '.fermer', 'secrets'), { recursive: true });
    mkdirSync(fermerDir, { recursive: true });
    const runScript = join(tempRepo, 'print-secret.js');

    writeFileSync(
      join(fermerDir, 'tokens.json'),
      JSON.stringify(
        {
          apiUrl: 'http://localhost:3000',
          accessToken: 'dummy-access-token',
          refreshToken: 'dummy-refresh-token',
          userId: 'user-1',
          email: 'demo@example.com',
          displayName: 'Demo User',
        },
        null,
        2,
      ),
      'utf8',
    );

    writeFileSync(
      join(tempRepo, '.fermer', 'secrets', 'dev.json'),
      JSON.stringify(
        {
          projectId: 'project-1',
          environmentId: 'dev',
          secrets: [
            { id: 'secret-1', name: 'MY_SECRET', version: 1, encryptedValue: 'plain:hello-world' },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );
    writeFileSync(runScript, `process.stdout.write(process.env.MY_SECRET || '')`, 'utf8');

    const baseEnv = {
      ...process.env,
      HOME: tempHome,
      USERPROFILE: tempHome,
      HOMEDRIVE: '',
      HOMEPATH: '',
    };

    try {
      const initOutput = execFileSync(process.execPath, [cliEntry, 'init', 'Demo Project'], {
        cwd: tempRepo,
        env: baseEnv,
        encoding: 'utf8',
      });
      expect(initOutput).toContain('fermer init');

      const linkOutput = execFileSync(process.execPath, [cliEntry, 'link', 'project-1'], {
        cwd: tempRepo,
        env: baseEnv,
        encoding: 'utf8',
      });
      expect(linkOutput).toContain('fermer link');

      const runOutput = execFileSync(
        process.execPath,
        [cliEntry, 'run', 'dev', '--', 'node', runScript],
        {
          cwd: tempRepo,
          env: baseEnv,
          encoding: 'utf8',
        },
      );
      expect(runOutput).toContain('hello-world');
    } finally {
      rmSync(tempRepo, { recursive: true, force: true });
      rmSync(tempHome, { recursive: true, force: true });
    }
  });
});
