const { inspect } = require('node:util');
const { formatSection, formatTip, formatWarning } = require('./utils/output.js');
const { getStorageSummary, loadTokens } = require('./storage/index.js');

function printHelp() {
  console.log(formatSection('fermer'));
  console.log('Secure environment distribution and runtime injection.');
  console.log('');
  console.log('Usage: fermer <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  login     Authenticate against the server');
  console.log('  logout    Clear local authentication');
  console.log('  whoami    Show the current authenticated user');
  console.log('  init      Initialize local project config');
  console.log('  link      Link this repository to a project');
  console.log('  unlink    Remove the local project association');
  console.log('  secrets   Manage secret metadata and sync');
  console.log('  run       Inject secrets and execute a command');
  console.log('');
  console.log('Examples:');
  console.log('  fermer login user@example.com password http://localhost:3000');
  console.log('  fermer init');
  console.log('  fermer link 2b2f7d2d-5f0d-4f55-8c6d-8f0d2a6f3f2a');
  console.log('  fermer secrets pull development');
  console.log('  fermer run development -- node app.js');
  console.log('');
  console.log(
    formatTip(`Local storage: ${inspect(getStorageSummary(), { colors: false, compact: true })}`),
  );
  const tokens = loadTokens();
  if (tokens?.userId) {
    console.log(formatTip(`Signed in as ${tokens.email || tokens.userId}`));
  } else {
    console.log(formatWarning('Not signed in. Use fermer login to authenticate.'));
  }
}

function printCommandHelp(command) {
  switch (command) {
    case 'login':
      console.log('Usage: fermer login <email> <password> [apiUrl]');
      console.log('Example: fermer login user@example.com password http://localhost:3000');
      console.log(
        'Tip: if apiUrl is omitted, the CLI uses FERMER_API_URL or http://localhost:3000.',
      );
      break;
    case 'logout':
      console.log('Usage: fermer logout');
      console.log('Removes the local session tokens from ~/.fermer/tokens.json.');
      break;
    case 'whoami':
      console.log('Usage: fermer whoami');
      console.log('Shows the authenticated user from the current local session.');
      break;
    case 'init':
      console.log('Usage: fermer init [name]');
      console.log('Creates .fermer/config.json for the current repository.');
      break;
    case 'link':
      console.log('Usage: fermer link <projectId>');
      console.log('Stores the project association in .fermer/config.json.');
      break;
    case 'unlink':
      console.log('Usage: fermer unlink');
      console.log('Removes the local project association from .fermer/config.json.');
      break;
    case 'secrets':
      console.log('Usage: fermer secrets <list|pull|sync> <environmentId>');
      console.log('Examples: fermer secrets list development');
      console.log('          fermer secrets pull development');
      console.log('          fermer secrets sync development');
      break;
    case 'run':
      console.log('Usage: fermer run <environmentId> -- <command> [args...]');
      console.log('Example: fermer run development -- node app.js');
      console.log('Requires a linked project and a cached secrets file for the environment.');
      break;
    default:
      printHelp();
  }
}

module.exports = {
  printCommandHelp,
  printHelp,
};
