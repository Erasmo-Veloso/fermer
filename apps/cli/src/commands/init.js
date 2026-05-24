const fs = require('node:fs');
const path = require('node:path');

function getRepoRoot() {
  return process.cwd();
}

function ensureLocalDir() {
  const dir = path.join(getRepoRoot(), '.fermer');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function init({ name }) {
  ensureLocalDir();
  const config = {
    name: name || path.basename(getRepoRoot()),
    createdAt: new Date().toISOString(),
  };
  const cfgPath = path.join(getRepoRoot(), '.fermer', 'config.json');
  fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), { encoding: 'utf8' });
  return config;
}

module.exports = { init };
