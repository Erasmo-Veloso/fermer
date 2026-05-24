import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomKey, encryptAesGcm } from '../../../../packages/crypto/src/index';

const originalCwd = process.cwd();
const originalKey = process.env.FERMER_LOCAL_KEY;

afterEach(() => {
  process.chdir(originalCwd);
  process.env.FERMER_LOCAL_KEY = originalKey;
});

describe('runtime injection', () => {
  it('loads plain and AES-GCM secret values from the local cache', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'fermer-inject-'));
    mkdirSync(join(tempRoot, '.fermer', 'secrets'), { recursive: true });

    const key = randomKey(32);
    process.env.FERMER_LOCAL_KEY = key.toString('base64');

    const encrypted = encryptAesGcm(Buffer.from('super-secret'), key);
    writeFileSync(
      join(tempRoot, '.fermer', 'secrets', 'dev.json'),
      JSON.stringify(
        {
          projectId: 'project-1',
          environmentId: 'dev',
          secrets: [
            { id: 's1', name: 'PLAIN_SECRET', version: 1, encryptedValue: 'plain:hello-world' },
            {
              id: 's2',
              name: 'ENCRYPTED_SECRET',
              version: 1,
              encryptedValue: JSON.stringify(encrypted),
            },
          ],
        },
        null,
        2,
      ),
      'utf8',
    );

    process.chdir(tempRoot);
    // @ts-expect-error runtime JS module used by Vitest
    const { injectEnvironment } = await import('../../src/injector.js');
    const env = await injectEnvironment('dev');

    expect(env.PLAIN_SECRET).toBe('hello-world');
    expect(env.ENCRYPTED_SECRET).toBe('super-secret');

    process.chdir(originalCwd);
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('spawns commands with the merged environment and inherited stdio', async () => {
    const tempRoot = mkdtempSync(join(tmpdir(), 'fermer-run-'));
    const outputFile = join(tempRoot, 'out.txt');
    const scriptFile = join(tempRoot, 'write-env.js');
    writeFileSync(
      scriptFile,
      `require('node:fs').writeFileSync(${JSON.stringify(outputFile)}, process.env.FERMER_TEST_VALUE || '')`,
      'utf8',
    );

    // @ts-expect-error runtime JS module used by Vitest
    const { runProcess } = await import('../../src/run/process.js');
    const code = await runProcess('node', [scriptFile], {
      FERMER_TEST_VALUE: 'ok',
    });

    expect(code).toBe(0);
    expect(readFileSync(outputFile, 'utf8')).toBe('ok');

    rmSync(tempRoot, { recursive: true, force: true });
  });
});
