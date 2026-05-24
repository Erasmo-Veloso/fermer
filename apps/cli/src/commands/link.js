const { loadTokens } = require('../storage/index.js');
const fs = require('node:fs');
const path = require('node:path');

function getRepoRoot() {
  return process.cwd();
}

function getLocalConfigPath() {
  return path.join(getRepoRoot(), '.fermer', 'config.json');
}

function ensureLocalDir() {
  const dir = path.join(getRepoRoot(), '.fermer');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function link({ projectId }) {
  const tokens = loadTokens();
  if (!tokens?.accessToken) throw new Error('Not authenticated. Run `fermer login`.');
  if (!projectId) throw new Error('Usage: fermer link <projectId>');

  ensureLocalDir();
  const cfg = { projectId: String(projectId), linkedAt: new Date().toISOString() };
  fs.writeFileSync(getLocalConfigPath(), JSON.stringify(cfg, null, 2), { encoding: 'utf8' });
  return cfg;
}

module.exports = { link };
