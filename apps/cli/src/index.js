const { inspect } = require('node:util');
const { formatSection, formatTip, formatError } = require('./utils/output.js');
const { getStorageSummary, loadTokens } = require('./storage/index.js');
const { login, logout, whoami, getApiBaseUrl } = require('./auth.js');

function printUsage(command) {
  if (command === 'login') {
    console.log('Usage: fermer login <email> <password> [apiUrl]');
    console.log(`Default apiUrl: ${getApiBaseUrl()}`);
    return;
  }

  if (command === 'whoami') {
    console.log('Usage: fermer whoami');
    return;
  }

  if (command === 'logout') {
    console.log('Usage: fermer logout');
    return;
  }
}

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
  const tokens = loadTokens();
  if (tokens?.userId) {
    console.log(formatTip(`Signed in as ${tokens.email || tokens.userId}`));
  }
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  switch (command) {
    case 'login':
      try {
        const [email, password, apiUrl] = rest;
        if (!email || !password) {
          printUsage('login');
          process.exitCode = 1;
          return;
        }

        const result = await login({ apiUrl, email, password });
        console.log(formatSection('fermer login'));
        console.log(formatTip(`Signed in as ${result.user.email}`));
        console.log(JSON.stringify({ user: result.user, apiUrl: result.apiUrl }, null, 2));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
      break;
    case 'logout':
      logout();
      console.log(formatSection('fermer logout'));
      console.log(formatTip('Local session cleared.'));
      break;
    case 'whoami':
      try {
        const result = await whoami();
        console.log(formatSection('fermer whoami'));
        console.log(JSON.stringify(result.user, null, 2));
      } catch (error) {
        console.error(formatError(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      }
      break;
    case 'init': {
      const { init } = require('./commands/init.js');
      const [name] = rest;
      try {
        const cfg = init({ name });
        console.log(formatSection('fermer init'));
        console.log(formatTip('Local project initialized.'));
        console.log(JSON.stringify(cfg, null, 2));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
      }
      break;
    }
    case 'link': {
      const { link } = require('./commands/link.js');
      const [projectId] = rest;
      try {
        const cfg = link({ projectId });
        console.log(formatSection('fermer link'));
        console.log(formatTip('Repository linked to project.'));
        console.log(JSON.stringify(cfg, null, 2));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
      }
      break;
    }
    case 'unlink': {
      const { unlink } = require('./commands/unlink.js');
      try {
        unlink();
        console.log(formatSection('fermer unlink'));
        console.log(formatTip('Local project association removed.'));
      } catch (err) {
        console.error(formatError(err instanceof Error ? err.message : String(err)));
        process.exitCode = 1;
      }
      break;
    }
    case 'secrets': {
      const [sub, ...srest] = rest;
      switch (sub) {
        case 'list': {
          const { listSecrets } = require('./commands/secrets/list.js');
          const [environmentId] = srest;
          try {
            const localCfg = (() => {
              try {
                return require(process.cwd() + '/.fermer/config.json');
              } catch {
                return null;
              }
            })();
            const projectId = localCfg?.projectId;
            listSecrets({ projectId, environmentId })
              .then((rows) => {
                console.log(formatSection('fermer secrets list'));
                console.log(JSON.stringify(rows, null, 2));
              })
              .catch((err) => {
                console.error(formatError(err instanceof Error ? err.message : String(err)));
                process.exitCode = 1;
              });
          } catch (err) {
            console.error(formatError(err instanceof Error ? err.message : String(err)));
            process.exitCode = 1;
          }
          break;
        }
        case 'pull': {
          const { pullSecrets } = require('./commands/secrets/pull.js');
          const [environmentId] = srest;
          try {
            const localCfg = (() => {
              try {
                return require(process.cwd() + '/.fermer/config.json');
              } catch {
                return null;
              }
            })();
            const projectId = localCfg?.projectId;
            pullSecrets({ projectId, environmentId })
              .then((out) => {
                console.log(formatSection('fermer secrets pull'));
                console.log(formatTip(`Wrote ${out.count} secrets to ${out.path}`));
              })
              .catch((err) => {
                console.error(formatError(err instanceof Error ? err.message : String(err)));
                process.exitCode = 1;
              });
          } catch (err) {
            console.error(formatError(err instanceof Error ? err.message : String(err)));
            process.exitCode = 1;
          }
          break;
        }
        case 'sync': {
          const { syncSecrets } = require('./commands/secrets/sync.js');
          const [environmentId] = srest;
          try {
            const localCfg = (() => {
              try {
                return require(process.cwd() + '/.fermer/config.json');
              } catch {
                return null;
              }
            })();
            const projectId = localCfg?.projectId;
            syncSecrets({ projectId, environmentId })
              .then((out) => {
                console.log(formatSection('fermer secrets sync'));
                console.log(formatTip(`${out.updatedCount} secrets updated locally.`));
              })
              .catch((err) => {
                console.error(formatError(err instanceof Error ? err.message : String(err)));
                process.exitCode = 1;
              });
          } catch (err) {
            console.error(formatError(err instanceof Error ? err.message : String(err)));
            process.exitCode = 1;
          }
          break;
        }
        default:
          console.log(formatSection('fermer secrets'));
          console.log(formatTip('Usage: fermer secrets <list|pull|sync> <environmentId>'));
      }
      break;
    }
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
