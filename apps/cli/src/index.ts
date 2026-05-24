import { inspect } from 'node:util';
import { formatSection, formatTip, formatError } from './utils/output';
import { getStorageSummary } from './storage';

function printHelp() {
  console.log(formatSection('fermer'));
  console.log('A CLI for secure environment distribution and runtime injection.');
  console.log('');
  console.log('Usage: fermer <command> [options]');
  console.log('');
  console.log('Commands:');
  console.log('  login     Authenticate against the server');
  console.log('  logout    Clear local authentication');
  console.log('  whoami    Show current session context');
  console.log('  init      Initialize local project config');
  console.log('  link      Link this repository to a project');
  console.log('  unlink    Remove the local project association');
  console.log('  secrets   Manage secret metadata and sync');
  console.log('  run       Inject secrets and execute a command');
  console.log('');
  console.log(
    formatTip(`Local storage: ${inspect(getStorageSummary(), { colors: false, compact: true })}`),
  );
}

function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'login':
    case 'logout':
    case 'whoami':
    case 'init':
    case 'link':
    case 'unlink':
    case 'secrets':
    case 'run':
      console.log(formatSection(`fermer ${command}`));
      console.log(
        formatTip('Command scaffolding is ready; implementation continues in later phases.'),
      );
      if (rest.length > 0) {
        console.log(JSON.stringify({ args: rest }, null, 2));
      }
      break;
    default:
      console.error(formatError(`Unknown command: ${command}`));
      console.log('');
      printHelp();
      process.exitCode = 1;
  }
}

main();
