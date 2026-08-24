#!/usr/bin/env node
import { COMMANDS, readVersion, extractEnv } from './cli-args.js';

const HELP_TEXT = `Usage: fermer <command> [options]

Commands:
  identity              Create or show your cryptographic identity
  init                  Initialize Fermer in the current repository
  set KEY=VALUE         Add or update a secret (--new-env to add the env)
  unset KEY             Remove a secret
  list                  List secret keys
  run <command...>      Run a command with secrets injected
  export                Output secrets as KEY=VALUE lines
  import [file]         Bulk-import an existing .env (default: .env)
  trust <key.pub>       Authorize a developer
  revoke <fingerprint>  Revoke a developer and rotate keys
  members               List authorized developers
  migrate               Upgrade an older .fermer/ member list

Options:
  -e, --env <name>      Target environment (default: development)
  --json                Machine-readable output (list, members, export)
  --dry-run             With import, report what would happen and write nothing
  --overwrite           With import, replace secrets that already exist
  -h, --help            Show this help
  --version             Show version

For "run", put -e/--env before the command being run so it is not mistaken
for a flag of that command, e.g. "fermer run -e production npm start".
`;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === '-h' || command === '--help') {
    process.stdout.write(HELP_TEXT);
    return;
  }

  if (command === '--version') {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }

  if (!COMMANDS.has(command)) {
    throw new Error(`Unknown command "${command}". Run "fermer --help" for usage.`);
  }

  const { env, rest } = extractEnv(argv.slice(1), { leadingOnly: command === 'run' });
  const commandModule = (await import(`./commands/${command}.js`)) as {
    execute(args: string[], opts: { env: string }): Promise<void>;
  };
  await commandModule.execute(rest, { env });
}

// Piping into something that stops reading early -- "fermer export | head",
// "fermer list | grep X" -- closes stdout under us, and the next write raises
// EPIPE. Unix tools exit quietly in that situation instead of reporting it as a
// failure, so this does the same rather than printing a stack trace over the
// output the user was actually reading.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') {
    process.exit(0);
  }
  throw err;
});

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
