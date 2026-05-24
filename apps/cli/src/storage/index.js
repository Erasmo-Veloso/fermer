const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function getFermerDir() {
  return path.join(os.homedir(), '.fermer');
}

function ensureDir() {
  fs.mkdirSync(getFermerDir(), { recursive: true });
}

function readJson(fileName) {
  const filePath = path.join(getFermerDir(), fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(fileName, value) {
  ensureDir();
  const filePath = path.join(getFermerDir(), fileName);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function getStorageSummary() {
  return {
    directory: getFermerDir(),
    tokensFile: path.join(getFermerDir(), 'tokens.json'),
    cacheFile: path.join(getFermerDir(), 'cache.json'),
  };
}

function loadTokens() {
  return readJson('tokens.json');
}

function saveTokens(tokens) {
  writeJson('tokens.json', tokens);
}

function clearTokens() {
  const filePath = path.join(getFermerDir(), 'tokens.json');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function loadCache() {
  return readJson('cache.json');
}

function saveCache(cache) {
  writeJson('cache.json', cache);
}

module.exports = {
  getStorageSummary,
  loadTokens,
  saveTokens,
  clearTokens,
  loadCache,
  saveCache,
};
