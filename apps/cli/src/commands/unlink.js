const fs = require('node:fs');
const path = require('node:path');
const { confirm } = require('../prompts/confirm.js');

function getRepoRoot() {
  return process.cwd();
}

function getLocalConfigPath() {
  return path.join(getRepoRoot(), '.fermer', 'config.json');
}

async function unlink() {
  const cfg = getLocalConfigPath();
  if (!fs.existsSync(cfg)) throw new Error('No local project linked in this repository.');
  const ok = await confirm('Remove the local project association?', false);
  if (!ok) return false;
  fs.unlinkSync(cfg);
  return true;
}

module.exports = { unlink };
