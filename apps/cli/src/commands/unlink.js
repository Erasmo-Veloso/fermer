const fs = require('node:fs');
const path = require('node:path');

function getRepoRoot() {
  return process.cwd();
}

function getLocalConfigPath() {
  return path.join(getRepoRoot(), '.fermer', 'config.json');
}

function unlink() {
  const cfg = getLocalConfigPath();
  if (!fs.existsSync(cfg)) throw new Error('No local project linked in this repository.');
  fs.unlinkSync(cfg);
  return true;
}

module.exports = { unlink };
