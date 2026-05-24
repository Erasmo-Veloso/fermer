const { injectEnvironment } = require('../injector.js');
const { runProcess } = require('../run/process.js');
const fs = require('node:fs');
const path = require('node:path');

function loadLocalCfg() {
  try {
    return require(process.cwd() + '/.fermer/config.json');
  } catch {
    return null;
  }
}

async function runCommand({ environmentId, cmdArgs }) {
  if (!environmentId) throw new Error('Usage: fermer run <environmentId> -- <command> [args]');
  if (!cmdArgs || cmdArgs.length === 0) throw new Error('No command specified to run');
  const cfg = loadLocalCfg();
  if (!cfg?.projectId) throw new Error('No project linked. Run `fermer link <projectId>`');

  const envMap = await injectEnvironment(environmentId);

  const command = cmdArgs[0];
  const args = cmdArgs.slice(1);
  const code = await runProcess(command, args, envMap);
  return code;
}

module.exports = { runCommand };
