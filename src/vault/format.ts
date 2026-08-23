import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import type { ConfigFile, VaultFile, MembersFile } from '../types.js';

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

function readJson<T>(path: string, kind: string): T {
  if (!existsSync(path)) {
    throw new Error(`${kind} not found at ${path}. Run "fermer init" first.`);
  }
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read ${kind} at ${path}: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${kind} at ${path} is not valid JSON.`);
  }
}

function stageJson(path: string, data: unknown): string {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return tmpPath;
}

function writeJsonAtomic(path: string, data: unknown): void {
  renameSync(stageJson(path, data), path);
}

export function readConfig(): ConfigFile {
  return readJson<ConfigFile>(configPath(), 'Fermer config');
}

export function writeConfig(config: ConfigFile): void {
  writeJsonAtomic(configPath(), config);
}

export function readVault(): VaultFile {
  return readJson<VaultFile>(vaultPath(), 'Fermer vault');
}

export function writeVault(vault: VaultFile): void {
  writeJsonAtomic(vaultPath(), vault);
}

export function readMembers(): MembersFile {
  return readJson<MembersFile>(membersPath(), 'Fermer members file');
}

export function writeMembers(members: MembersFile): void {
  writeJsonAtomic(membersPath(), members);
}

// Key rotation rewrites both files at once. Writing them one after the other
// leaves a window where the vault is encrypted with a new project key while
// members.json still holds everyone's old wrapped key, which locks every member
// out. Both files are written to temp paths first so the visible switch is two
// adjacent renames within the same directory.
export function writeVaultAndMembers(vault: VaultFile, members: MembersFile): void {
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
}
