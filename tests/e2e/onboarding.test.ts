import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as identityCmd from '../../src/commands/identity';
import * as initCmd from '../../src/commands/init';
import * as setCmd from '../../src/commands/set';
import * as listCmd from '../../src/commands/list';
import * as exportCmd from '../../src/commands/export';
import * as trustCmd from '../../src/commands/trust';
import * as revokeCmd from '../../src/commands/revoke';
import * as membersCmd from '../../src/commands/members';
import { loadIdentity } from '../../src/identity/index';

let repoRoot: string;
let aliceHome: string;
let bobHome: string;
let originalCwd: string;
let originalHome: string | undefined;
let stdout: string[];

function asDeveloper(home: string): void {
  process.env.FERMER_HOME = home;
}

async function capture(run: () => Promise<void>): Promise<string> {
  stdout.length = 0;
  await run();
  return stdout.join('');
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-e2e-'));
  mkdirSync(join(repoRoot, '.git'));
  aliceHome = mkdtempSync(join(tmpdir(), 'fermer-e2e-alice-'));
  bobHome = mkdtempSync(join(tmpdir(), 'fermer-e2e-bob-'));

  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;

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
  for (const dir of [repoRoot, aliceHome, bobHome]) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('e2e: onboarding a teammate and later removing them', () => {
  it('walks the full lifecycle through the command layer', async () => {
    // 1. Alice creates her identity.
    asDeveloper(aliceHome);
    const created = await capture(() => identityCmd.execute(['alice@workstation'], { env: 'development' }));
    expect(created).toContain('Identity created.');
    const alice = loadIdentity();

    // 2. Alice initializes fermer in the repository.
    const initOutput = await capture(() => initCmd.execute([], { env: 'development' }));
    expect(initOutput).toContain('Fermer initialized');
    expect(existsSync(join(repoRoot, '.fermer', 'vault.json'))).toBe(true);
    expect(readFileSync(join(repoRoot, '.gitattributes'), 'utf8')).toContain('merge=binary');

    // 3. Alice sets three secrets across two environments.
    await setCmd.execute(['DATABASE_URL=postgres://localhost/db'], { env: 'development' });
    await setCmd.execute(['API_KEY=dev-key'], { env: 'development' });
    await setCmd.execute(['API_KEY=prod-key'], { env: 'production' });

    expect(JSON.parse(await capture(() => listCmd.execute(['--json'], { env: 'development' })))).toEqual([
      'API_KEY',
      'DATABASE_URL',
    ]);
    expect(JSON.parse(await capture(() => listCmd.execute(['--json'], { env: 'production' })))).toEqual(['API_KEY']);

    // 4. Bob creates his identity and exports his public key in one step.
    asDeveloper(bobHome);
    const bobPublicKeyPath = join(bobHome, 'bob.pub');
    await identityCmd.execute(['bob@laptop', '--export', bobPublicKeyPath], { env: 'development' });
    const bob = loadIdentity();
    expect(readFileSync(bobPublicKeyPath, 'utf8')).toContain('BEGIN PUBLIC KEY');
    expect(readFileSync(bobPublicKeyPath, 'utf8')).not.toContain('PRIVATE');

    // 5. Bob cannot read anything before Alice trusts him.
    await expect(exportCmd.execute([], { env: 'development' })).rejects.toThrow(/not authorized/);

    // 6. Alice trusts Bob's public key.
    asDeveloper(aliceHome);
    const trustOutput = await capture(() => trustCmd.execute([bobPublicKeyPath], { env: 'development' }));
    expect(trustOutput).toContain(bob.fingerprint);

    const members = JSON.parse(await capture(() => membersCmd.execute(['--json'], { env: 'development' })));
    expect(members.map((m: { fingerprint: string }) => m.fingerprint).sort()).toEqual(
      [alice.fingerprint, bob.fingerprint].sort(),
    );

    // 7. Bob can now decrypt both environments.
    asDeveloper(bobHome);
    expect(JSON.parse(await capture(() => exportCmd.execute(['--json'], { env: 'development' })))).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      API_KEY: 'dev-key',
    });
    expect(JSON.parse(await capture(() => exportCmd.execute(['--json'], { env: 'production' })))).toEqual({
      API_KEY: 'prod-key',
    });

    // 8. Alice revokes Bob, which rotates the project key.
    asDeveloper(aliceHome);
    const revokeOutput = await capture(() => revokeCmd.execute([bob.fingerprint], { env: 'development' }));
    expect(revokeOutput).toContain('rotated');

    // 9. Bob is locked out of every environment.
    asDeveloper(bobHome);
    await expect(exportCmd.execute([], { env: 'development' })).rejects.toThrow();
    await expect(exportCmd.execute([], { env: 'production' })).rejects.toThrow();

    // 10. Alice's own access is unaffected, and the values survived rotation.
    asDeveloper(aliceHome);
    expect(JSON.parse(await capture(() => exportCmd.execute(['--json'], { env: 'development' })))).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
      API_KEY: 'dev-key',
    });
    expect(JSON.parse(await capture(() => exportCmd.execute(['--json'], { env: 'production' })))).toEqual({
      API_KEY: 'prod-key',
    });

    const remaining = JSON.parse(await capture(() => membersCmd.execute(['--json'], { env: 'development' })));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].fingerprint).toBe(alice.fingerprint);
    expect(remaining[0].isSelf).toBe(true);
  });

  it('never writes a plaintext secret into the repository', async () => {
    asDeveloper(aliceHome);
    await identityCmd.execute(['alice@workstation'], { env: 'development' });
    await initCmd.execute([], { env: 'development' });
    await setCmd.execute(['DATABASE_URL=super-secret-value'], { env: 'development' });

    for (const file of ['config.json', 'vault.json', 'members.json']) {
      const contents = readFileSync(join(repoRoot, '.fermer', file), 'utf8');
      expect(contents).not.toContain('super-secret-value');
      expect(contents).not.toContain('PRIVATE KEY');
    }
  });

  it('supports adding an environment the project did not start with', async () => {
    asDeveloper(aliceHome);
    await identityCmd.execute(['alice@workstation'], { env: 'development' });
    await initCmd.execute([], { env: 'development' });

    await expect(setCmd.execute(['TOKEN=t'], { env: 'preview' })).rejects.toThrow(/Unknown environment/);

    await setCmd.execute(['TOKEN=t', '--new-env'], { env: 'preview' });
    expect(JSON.parse(await capture(() => exportCmd.execute(['--json'], { env: 'preview' })))).toEqual({ TOKEN: 't' });
  });
});
