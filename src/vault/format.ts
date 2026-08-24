import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  rmSync,
  openSync,
  writeSync,
  fsyncSync,
  closeSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { ConfigFile, VaultFile, MembersFile, LegacyMembersFile } from '../types.js';
import { verifyMemberChain } from './attest.js';

export function findRepoRoot(): string {
  let dir = resolve(process.cwd());
  while (true) {
    if (existsSync(join(dir, '.git'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('Not inside a git repository. Run this command from within a git repo.');
    }
    dir = parent;
  }
}

export function fermerDir(): string {
  return join(findRepoRoot(), '.fermer');
}

function configPath(): string {
  return join(fermerDir(), 'config.json');
}

function vaultPath(): string {
  return join(fermerDir(), 'vault.json');
}

function membersPath(): string {
  return join(fermerDir(), 'members.json');
}

const GIT_ATTRIBUTES_RULES = [
  '.fermer/vault.json merge=binary',
  '.fermer/members.json merge=binary',
];

// Git's line-based merge driver cannot usefully merge encrypted JSON: a
// three-way merge of two ciphertexts produces bytes that decrypt to nothing.
// Marking the files binary makes Git report a conflict for a human to resolve
// with "fermer set" instead of silently writing a corrupt vault.
export function ensureGitAttributes(): 'created' | 'updated' | 'unchanged' {
  const path = join(findRepoRoot(), '.gitattributes');
  const existing = existsSync(path) ? readFileSync(path, 'utf8') : undefined;
  const lines = existing === undefined ? [] : existing.split(/\r?\n/);
  const missing = GIT_ATTRIBUTES_RULES.filter((rule) => !lines.includes(rule));

  if (missing.length === 0) {
    return 'unchanged';
  }

  const separator = existing === undefined || existing.length === 0 || existing.endsWith('\n') ? '' : '\n';
  writeFileSync(path, `${existing ?? ''}${separator}${missing.join('\n')}\n`, 'utf8');
  return existing === undefined ? 'created' : 'updated';
}

const SUPPORTED_VERSION = 1;

// A missing file means two very different things. If .fermer/ is absent the
// project was never initialized, so "fermer init" is the fix. If .fermer/ is
// there but a file inside it is gone, init would refuse to run and the real
// remedy is restoring the file from Git, so saying "run init" would send the
// user down a dead end.
function missingFileMessage(path: string, kind: string): string {
  if (!existsSync(fermerDir())) {
    return `No .fermer/ directory in this repository. Run "fermer init" first.`;
  }
  return `${kind} is missing at ${path} but .fermer/ exists, so the vault is incomplete. Restore the file from Git history.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(kind: string, path: string, detail: string): never {
  throw new Error(`${kind} at ${path} is malformed: ${detail}`);
}

function assertEnvelope(data: unknown, kind: string, path: string): Record<string, unknown> {
  if (!isRecord(data)) {
    fail(kind, path, 'expected a JSON object at the top level.');
  }
  if (data.version !== SUPPORTED_VERSION) {
    throw new Error(
      `${kind} at ${path} has version ${JSON.stringify(data.version)}, but this build of fermer only understands version ${SUPPORTED_VERSION}. Upgrade fermer.`,
    );
  }
  return data;
}

function assertEncryptedValue(value: unknown, kind: string, path: string, where: string): void {
  if (!isRecord(value)) fail(kind, path, `${where} is not an object.`);
  for (const field of ['iv', 'ciphertext', 'tag']) {
    if (typeof value[field] !== 'string') fail(kind, path, `${where} is missing a string "${field}".`);
  }
}

function validateConfig(data: unknown, path: string): ConfigFile {
  const kind = 'Fermer config';
  const record = assertEnvelope(data, kind, path);
  if (!Array.isArray(record.environments) || record.environments.some((e) => typeof e !== 'string')) {
    fail(kind, path, '"environments" must be an array of strings.');
  }
  if (typeof record.defaultEnvironment !== 'string') {
    fail(kind, path, '"defaultEnvironment" must be a string.');
  }
  return record as unknown as ConfigFile;
}

function validateVault(data: unknown, path: string): VaultFile {
  const kind = 'Fermer vault';
  const record = assertEnvelope(data, kind, path);
  if (!isRecord(record.environments)) {
    fail(kind, path, '"environments" must be an object.');
  }
  for (const [env, entry] of Object.entries(record.environments)) {
    if (!isRecord(entry) || !isRecord(entry.secrets)) {
      fail(kind, path, `environment "${env}" must have a "secrets" object.`);
    }
    for (const [key, value] of Object.entries(entry.secrets)) {
      assertEncryptedValue(value, kind, path, `secret "${key}" in "${env}"`);
    }
  }
  return record as unknown as VaultFile;
}

function validateMembersShape(data: unknown, path: string, kind: string, expectedVersion: number): Record<string, unknown> {
  if (!isRecord(data)) {
    fail(kind, path, 'expected a JSON object at the top level.');
  }
  if (data.version !== expectedVersion) {
    fail(kind, path, `expected version ${expectedVersion}.`);
  }
  if (!isRecord(data.members)) {
    fail(kind, path, '"members" must be an object.');
  }
  for (const [fingerprint, entry] of Object.entries(data.members)) {
    const where = `member "${fingerprint}"`;
    if (!isRecord(entry)) fail(kind, path, `${where} is not an object.`);
    if (typeof entry.publicKey !== 'string') fail(kind, path, `${where} is missing a string "publicKey".`);
    if (typeof entry.label !== 'string') fail(kind, path, `${where} is missing a string "label".`);
    assertEncryptedValue(entry.wrappedKey, kind, path, `${where}'s wrappedKey`);
    if (typeof (entry.wrappedKey as Record<string, unknown>).ephemeralPublicKey !== 'string') {
      fail(kind, path, `${where}'s wrappedKey is missing a string "ephemeralPublicKey".`);
    }
  }
  return data;
}

function validateMembers(data: unknown, path: string): MembersFile {
  const kind = 'Fermer members file';

  if (isRecord(data) && data.version === 1) {
    throw new Error(
      `${kind} at ${path} uses the unsigned version 1 format. Members are now cryptographically attested so an entry cannot be added by editing the file directly. Run "fermer migrate" to upgrade, after reviewing the member list.`,
    );
  }

  const record = validateMembersShape(data, path, kind, 2);
  for (const [fingerprint, entry] of Object.entries(record.members as Record<string, Record<string, unknown>>)) {
    if (typeof entry.addedBy !== 'string') {
      fail(kind, path, `member "${fingerprint}" is missing a string "addedBy".`);
    }
    if (typeof entry.signature !== 'string') {
      fail(kind, path, `member "${fingerprint}" is missing a string "signature".`);
    }
  }

  const members = record as unknown as MembersFile;
  const chain = verifyMemberChain(members.members);
  if (!chain.ok) {
    throw new Error(
      `${kind} at ${path} is not trustworthy: ${chain.reason}. Someone may have edited it directly instead of using "fermer trust". Inspect the file's history with "git log -p .fermer/members.json" and restore a known-good version.`,
    );
  }
  return members;
}

export function readLegacyMembers(): LegacyMembersFile {
  return readJson(membersPath(), 'Fermer members file', (data, path) => {
    const record = validateMembersShape(data, path, 'Fermer members file', 1);
    return record as unknown as LegacyMembersFile;
  });
}

// Every command reads a file, changes it in memory, and writes it back. If a
// teammate's command (or a git checkout) rewrites the same file in between, a
// blind write would silently drop their change. The digest seen at read time is
// remembered so the write can refuse instead.
const digestsAtRead = new Map<string, string>();

function digestOf(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

function assertUnchangedSinceRead(path: string, kind: string): void {
  const atRead = digestsAtRead.get(path);
  if (atRead === undefined) {
    return;
  }
  const now = existsSync(path) ? digestOf(readFileSync(path, 'utf8')) : undefined;
  if (now !== atRead) {
    throw new Error(
      `${kind} at ${path} changed on disk while this command was running, so writing would discard that change. Re-run the command.`,
    );
  }
}

function readJson<T>(path: string, kind: string, validate: (data: unknown, path: string) => T): T {
  if (!existsSync(path)) {
    throw new Error(missingFileMessage(path, kind));
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ${kind} at ${path}: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${kind} at ${path} is not valid JSON.`);
  }
  const validated = validate(parsed, path);
  digestsAtRead.set(path, digestOf(raw));
  return validated;
}

function serialize(data: unknown): string {
  return JSON.stringify(data, null, 2) + '\n';
}

// Renaming a fully written temp file over the target keeps a torn write from
// ever being visible to a reader. It does not by itself guarantee the bytes
// reached the disk before the rename did, so a power loss could surface a
// renamed but empty file; fsync before closing closes that gap.
function writeFileDurable(path: string, contents: string): void {
  const fd = openSync(path, 'w');
  try {
    writeSync(fd, contents);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function stageContents(path: string, contents: string): string {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.${process.pid}.tmp`;
  writeFileDurable(tmpPath, contents);
  return tmpPath;
}

function stageJson(path: string, data: unknown): string {
  return stageContents(path, serialize(data));
}

function writeJsonAtomic(path: string, kind: string, data: unknown): void {
  assertUnchangedSinceRead(path, kind);
  const contents = serialize(data);
  renameSync(stageContents(path, contents), path);
  digestsAtRead.set(path, digestOf(contents));
}

// init used to write config, vault, and members one at a time. Failing after
// the first left .fermer/ present but incomplete, which is the worst state to
// be in: init refuses to run again because the directory exists, and every
// other command fails because members.json is missing. Building the directory
// under a staging name and renaming it into place means .fermer/ either does
// not exist or is complete.
export function initializeFermerDir(config: ConfigFile, vault: VaultFile, members: MembersFile): void {
  const target = fermerDir();
  if (existsSync(target)) {
    throw new Error(`Fermer is already initialized at ${target}.`);
  }

  const staging = `${target}.init-${process.pid}`;
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  try {
    writeFileDurable(join(staging, 'config.json'), serialize(config));
    writeFileDurable(join(staging, 'vault.json'), serialize(vault));
    writeFileDurable(join(staging, 'members.json'), serialize(members));
    renameSync(staging, target);
  } catch (err) {
    rmSync(staging, { recursive: true, force: true });
    throw err;
  }
}

export function readConfig(): ConfigFile {
  return readJson(configPath(), 'Fermer config', validateConfig);
}

export function writeConfig(config: ConfigFile): void {
  writeJsonAtomic(configPath(), 'Fermer config', config);
}

export function readVault(): VaultFile {
  return readJson(vaultPath(), 'Fermer vault', validateVault);
}

export function writeVault(vault: VaultFile): void {
  writeJsonAtomic(vaultPath(), 'Fermer vault', vault);
}

export function readMembers(): MembersFile {
  return readJson(membersPath(), 'Fermer members file', validateMembers);
}

export function writeMembers(members: MembersFile): void {
  writeJsonAtomic(membersPath(), 'Fermer members file', members);
}

// Key rotation rewrites both files at once. Writing them one after the other
// leaves a window where the vault is encrypted with a new project key while
// members.json still holds everyone's old wrapped key, which locks every member
// out. Both files are written to temp paths first so the visible switch is two
// adjacent renames within the same directory.
export function writeVaultAndMembers(vault: VaultFile, members: MembersFile): void {
  assertUnchangedSinceRead(vaultPath(), 'Fermer vault');
  assertUnchangedSinceRead(membersPath(), 'Fermer members file');

  const vaultTmp = stageJson(vaultPath(), vault);
  let membersTmp: string;
  try {
    membersTmp = stageJson(membersPath(), members);
  } catch (err) {
    rmSync(vaultTmp, { force: true });
    throw err;
  }

  try {
    renameSync(vaultTmp, vaultPath());
  } catch (err) {
    rmSync(vaultTmp, { force: true });
    rmSync(membersTmp, { force: true });
    throw err;
  }

  renameSync(membersTmp, membersPath());

  digestsAtRead.set(vaultPath(), digestOf(serialize(vault)));
  digestsAtRead.set(membersPath(), digestOf(serialize(members)));
}
