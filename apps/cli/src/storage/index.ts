import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

type Tokens = {
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
};

type Cache = {
  projectId?: string;
  projectSlug?: string;
  environmentId?: string;
  updatedAt?: string;
};

function getFermerDir() {
  return path.join(os.homedir(), '.fermer');
}

function ensureDir() {
  fs.mkdirSync(getFermerDir(), { recursive: true });
}

function readJson<T>(fileName: string): T | null {
  const filePath = path.join(getFermerDir(), fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(fileName: string, value: unknown) {
  ensureDir();
  const filePath = path.join(getFermerDir(), fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function getStorageSummary() {
  return {
    directory: getFermerDir(),
    tokensFile: path.join(getFermerDir(), 'tokens.json'),
    cacheFile: path.join(getFermerDir(), 'cache.json'),
  };
}

export function loadTokens() {
  return readJson<Tokens>('tokens.json');
}

export function saveTokens(tokens: Tokens) {
  writeJson('tokens.json', tokens);
}

export function clearTokens() {
  const filePath = path.join(getFermerDir(), 'tokens.json');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function loadCache() {
  return readJson<Cache>('cache.json');
}

export function saveCache(cache: Cache) {
  writeJson('cache.json', cache);
}
