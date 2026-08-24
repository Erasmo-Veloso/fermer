import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createIdentity } from '../src/identity/index';
import {
  initVault,
  setSecret,
  getSecrets,
  trustMember,
  revokeMember,
  listMembers,
  migrateMembers,
} from '../src/vault/index';
import { wrapProjectKey } from '../src/crypto/wrap';
import { randomKey } from '../src/crypto/index';
import { signMemberEntry } from '../src/vault/attest';
import { fermerDir } from '../src/vault/format';
import type { Identity } from '../src/types';

let repoRoot: string;
let originalCwd: string;
let originalHome: string | undefined;
let homes: string[];

function asDeveloper(home: string): void {
  process.env.FERMER_HOME = home;
}

function newHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'fermer-attest-home-'));
  homes.push(home);
  return home;
}

function membersPath(): string {
  return join(fermerDir(), 'members.json');
}

function readRawMembers(): any {
  return JSON.parse(readFileSync(membersPath(), 'utf8'));
}

function writeRawMembers(data: unknown): void {
  writeFileSync(membersPath(), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** Sets up a project with a founder plus one trusted member. */
function projectWithTwoMembers(): {
  alice: Identity;
  aliceHome: string;
  bob: Identity;
  bobHome: string;
} {
  const aliceHome = newHome();
  asDeveloper(aliceHome);
  const alice = createIdentity('alice@box');
  initVault(alice);
  setSecret('STRIPE_KEY', 'sk_live_real', 'development', alice);

  const bobHome = newHome();
  asDeveloper(bobHome);
  const bob = createIdentity('bob@box');
  const bobPub = join(bobHome, 'bob.pub');
  writeFileSync(bobPub, bob.publicKey, 'utf8');

  asDeveloper(aliceHome);
  trustMember(bobPub, alice);

  return { alice, aliceHome, bob, bobHome };
}

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'fermer-attest-'));
  mkdirSync(join(repoRoot, '.git'));
  originalCwd = process.cwd();
  process.chdir(repoRoot);
  originalHome = process.env.FERMER_HOME;
  homes = [];
});

afterEach(() => {
  process.chdir(originalCwd);
  if (originalHome === undefined) {
    delete process.env.FERMER_HOME;
  } else {
    process.env.FERMER_HOME = originalHome;
  }
  rmSync(repoRoot, { recursive: true, force: true });
  for (const home of homes) rmSync(home, { recursive: true, force: true });
});

describe('attestation: the self-added member attack', () => {
  it('rejects an entry inserted by editing members.json directly', () => {
    const { alice, aliceHome } = projectWithTwoMembers();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    const members = readRawMembers();
    members.members[mallory.fingerprint] = {
      publicKey: mallory.publicKey,
      label: 'ci-runner',
      wrappedKey: wrapProjectKey(randomKey(32), mallory.publicKey),
      addedAt: new Date().toISOString(),
      addedBy: alice.fingerprint,
      signature: 'ZmFrZS1zaWduYXR1cmU=',
    };
    writeRawMembers(members);

    asDeveloper(aliceHome);
    expect(() => listMembers(alice)).toThrow(/not attested by anyone the project trusts/);
  });

  it('rejects a self-attested intruder rather than treating them as a second founder', () => {
    const { alice, aliceHome } = projectWithTwoMembers();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    // Mallory holds her own private key, so she can produce a signature that
    // verifies -- against herself. This is the attack the single-root rule
    // exists to stop.
    const members = readRawMembers();
    members.members[mallory.fingerprint] = signMemberEntry(
      mallory.fingerprint,
      {
        publicKey: mallory.publicKey,
        label: 'ci-runner',
        wrappedKey: wrapProjectKey(randomKey(32), mallory.publicKey),
        addedAt: new Date().toISOString(),
        addedBy: mallory.fingerprint,
      },
      mallory,
    );
    writeRawMembers(members);

    asDeveloper(aliceHome);
    expect(() => listMembers(alice)).toThrow(/more than one member claims to be the project founder/);
  });

  it('blocks the escalation that a revocation used to grant', () => {
    const { alice, aliceHome, bob } = projectWithTwoMembers();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    const members = readRawMembers();
    members.members[mallory.fingerprint] = signMemberEntry(
      mallory.fingerprint,
      {
        publicKey: mallory.publicKey,
        label: 'ci-runner',
        wrappedKey: wrapProjectKey(randomKey(32), mallory.publicKey),
        addedAt: new Date().toISOString(),
        addedBy: mallory.fingerprint,
      },
      mallory,
    );
    writeRawMembers(members);

    // Alice cannot even perform the revocation that previously re-wrapped the
    // new project key for the forged entry.
    asDeveloper(aliceHome);
    expect(() => revokeMember(bob.fingerprint, alice)).toThrow(/more than one member claims/);

    // And Mallory still cannot read anything.
    asDeveloper(malloryHome);
    expect(() => getSecrets('development', mallory)).toThrow();
  });

  it('rejects a forged entry that reuses a real member\'s signature', () => {
    const { alice, aliceHome, bob } = projectWithTwoMembers();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    const members = readRawMembers();
    // Copy Bob's legitimate signature onto Mallory's entry. The signature binds
    // the fingerprint and public key, so it cannot be transplanted.
    members.members[mallory.fingerprint] = {
      ...members.members[bob.fingerprint],
      publicKey: mallory.publicKey,
      label: 'ci-runner',
    };
    writeRawMembers(members);

    asDeveloper(aliceHome);
    expect(() => listMembers(alice)).toThrow(/not attested by anyone the project trusts/);
  });

  it('rejects a relabelled member, since the label is signed', () => {
    const { alice, aliceHome, bob } = projectWithTwoMembers();

    const members = readRawMembers();
    members.members[bob.fingerprint].label = 'trusted-admin';
    writeRawMembers(members);

    asDeveloper(aliceHome);
    expect(() => listMembers(alice)).toThrow(/not attested/);
  });
});

describe('attestation: legitimate operations keep the chain valid', () => {
  it('accepts a project created by init', () => {
    const home = newHome();
    asDeveloper(home);
    const alice = createIdentity('alice@box');
    initVault(alice);

    expect(listMembers(alice)).toHaveLength(1);
  });

  it('accepts a member added by trust', () => {
    const { alice, aliceHome, bob, bobHome } = projectWithTwoMembers();

    asDeveloper(aliceHome);
    expect(listMembers(alice)).toHaveLength(2);

    asDeveloper(bobHome);
    expect(getSecrets('development', bob).STRIPE_KEY).toBe('sk_live_real');
  });

  it('keeps the chain valid through a revocation', () => {
    const { alice, aliceHome, bob, bobHome } = projectWithTwoMembers();

    // Bob adds Carol, so Carol's attester is about to be revoked.
    const carolHome = newHome();
    asDeveloper(carolHome);
    const carol = createIdentity('carol@box');
    const carolPub = join(carolHome, 'carol.pub');
    writeFileSync(carolPub, carol.publicKey, 'utf8');
    asDeveloper(bobHome);
    trustMember(carolPub, bob);

    asDeveloper(aliceHome);
    revokeMember(bob.fingerprint, alice);

    // Carol's grant was made by a member who is now gone, so Alice re-attested
    // it; Carol keeps working and the file still verifies.
    expect(listMembers(alice).map((m) => m.label).sort()).toEqual(['alice@box', 'carol']);
    asDeveloper(carolHome);
    expect(getSecrets('development', carol).STRIPE_KEY).toBe('sk_live_real');
  });

  it('makes the revoker the new root when the founder is revoked', () => {
    const { alice, bob, bobHome } = projectWithTwoMembers();

    asDeveloper(bobHome);
    revokeMember(alice.fingerprint, bob);

    expect(listMembers(bob).map((m) => m.label)).toEqual(['bob']);
    expect(getSecrets('development', bob).STRIPE_KEY).toBe('sk_live_real');

    const raw = readRawMembers();
    expect(raw.members[bob.fingerprint].addedBy).toBe(bob.fingerprint);
  });

  it('refuses to let the founder revoke themselves', () => {
    const { alice, aliceHome } = projectWithTwoMembers();

    asDeveloper(aliceHome);
    expect(() => revokeMember(alice.fingerprint, alice)).toThrow(/project founder/);
  });
});

describe('attestation: migrating an unsigned member list', () => {
  function downgradeToVersion1(): void {
    const members = readRawMembers();
    members.version = 1;
    for (const entry of Object.values<any>(members.members)) {
      delete entry.addedBy;
      delete entry.signature;
    }
    writeRawMembers(members);
  }

  it('refuses to read a version 1 file and points at migrate', () => {
    const { alice, aliceHome } = projectWithTwoMembers();
    downgradeToVersion1();

    asDeveloper(aliceHome);
    expect(() => listMembers(alice)).toThrow(/fermer migrate/);
  });

  it('upgrades a version 1 file and restores normal operation', () => {
    const { alice, aliceHome, bob, bobHome } = projectWithTwoMembers();
    downgradeToVersion1();

    asDeveloper(aliceHome);
    const vouched = migrateMembers(alice);

    expect(vouched).toHaveLength(2);
    expect(readRawMembers().version).toBe(2);
    expect(listMembers(alice)).toHaveLength(2);

    asDeveloper(bobHome);
    expect(getSecrets('development', bob).STRIPE_KEY).toBe('sk_live_real');
  });

  it('refuses to migrate for someone who is not a member', () => {
    projectWithTwoMembers();
    downgradeToVersion1();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    expect(() => migrateMembers(mallory)).toThrow(/not in this project's member list/);
  });

  it('refuses to migrate for someone who appended themselves to the unsigned file', () => {
    projectWithTwoMembers();
    downgradeToVersion1();

    const malloryHome = newHome();
    asDeveloper(malloryHome);
    const mallory = createIdentity('mallory@box');

    // Mallory is listed, but her wrapped key is not the real project key, so
    // she cannot prove membership.
    const members = readRawMembers();
    members.members[mallory.fingerprint] = {
      publicKey: mallory.publicKey,
      label: 'ci-runner',
      wrappedKey: wrapProjectKey(randomKey(32), mallory.publicKey),
      addedAt: new Date().toISOString(),
    };
    writeRawMembers(members);

    expect(() => migrateMembers(mallory)).toThrow();
  });
});
