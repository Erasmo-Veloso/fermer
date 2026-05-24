const { formatSection, formatTip } = require('./utils/output.js');
const { login, logout, whoami } = require('./auth.js');
const { formatCliError } = require('./errors.js');
const { printHelp, printCommandHelp } = require('./help.js');

function reportError(error) {
  console.error(formatCliError(error));
  process.exitCode = 1;
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return;
  }

  if (rest[0] === '--help' || rest[0] === '-h' || rest[0] === 'help') {
    printCommandHelp(command);
    return;
  }

  switch (command) {
    case 'login':
      try {
        const [email, password, apiUrl] = rest;
        if (!email || !password) {
          printCommandHelp('login');
          process.exitCode = 1;
          return;
        }

        const result = await login({ apiUrl, email, password });
        console.log(formatSection('fermer login'));
        console.log(formatTip(`Signed in as ${result.user.email}`));
        console.log(JSON.stringify({ user: result.user, apiUrl: result.apiUrl }, null, 2));
      } catch (error) {
        reportError(error);
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
        reportError(error);
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
        reportError(err);
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
        reportError(err);
      }
      break;
    }
    case 'unlink': {
      const { unlink } = require('./commands/unlink.js');
      try {
        const removed = await unlink();
        if (removed) {
          console.log(formatSection('fermer unlink'));
          console.log(formatTip('Local project association removed.'));
        }
      } catch (err) {
        reportError(err);
      }
      break;
    }
    case 'secrets': {
      const [sub, ...srest] = rest;
      const getLocalConfig = () => {
        try {
          return require(process.cwd() + '/.fermer/config.json');
        } catch {
          return null;
        }
      };

      switch (sub) {
        case 'list': {
          const { listSecrets } = require('./commands/secrets/list.js');
          const [environmentId] = srest;
          try {
            const localCfg = getLocalConfig();
            const projectId = localCfg?.projectId;
            const rows = await listSecrets({ projectId, environmentId });
            console.log(formatSection('fermer secrets list'));
            console.log(JSON.stringify(rows, null, 2));
          } catch (err) {
            reportError(err);
          }
          break;
        }
        case 'pull': {
          const { pullSecrets } = require('./commands/secrets/pull.js');
          const [environmentId] = srest;
          try {
            const localCfg = getLocalConfig();
            const projectId = localCfg?.projectId;
            const out = await pullSecrets({ projectId, environmentId });
            console.log(formatSection('fermer secrets pull'));
            console.log(formatTip(`Wrote ${out.count} secrets to ${out.path}`));
          } catch (err) {
            reportError(err);
          }
          break;
        }
        case 'sync': {
          const { syncSecrets } = require('./commands/secrets/sync.js');
          const [environmentId] = srest;
          try {
            const localCfg = getLocalConfig();
            const projectId = localCfg?.projectId;
            const out = await syncSecrets({ projectId, environmentId });
            console.log(formatSection('fermer secrets sync'));
            console.log(formatTip(`${out.updatedCount} secrets updated locally.`));
          } catch (err) {
            reportError(err);
          }
          break;
        }
        default:
          printCommandHelp('secrets');
      }
      break;
    }
    case 'run':
      try {
        const { runCommand } = require('./commands/run.js');
        const split = rest.indexOf('--');
        const envId = split === -1 ? rest[0] : rest.slice(0, split)[0];
        const cmdArgs = split === -1 ? rest.slice(1) : rest.slice(split + 1);

        const code = await runCommand({ environmentId: envId, cmdArgs });
        process.exit(code);
      } catch (err) {
        reportError(err);
      }
      break;
    default:
      reportError(`Unknown command: ${command}`);
      console.log('');
      printHelp();
  }
}

main();
