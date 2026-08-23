#!/usr/bin/env node
import { COMMANDS, readVersion, extractEnv } from './cli-args.js';

const HELP_TEXT = `Usage: fermer <command> [options]

Commands:
  identity              Create or show your cryptographic identity
  init                  Initialize Fermer in the current repository
  set KEY=VALUE         Add or update a secret
  unset KEY             Remove a secret
  list                  List secret keys
  run <command...>      Run a command with secrets injected
  export                Output secrets as KEY=VALUE lines
  trust <key.pub>       Authorize a developer
  revoke <fingerprint>  Revoke a developer and rotate keys
  members               List authorized developers

Options:
  -e, --env <name>      Target environment (default: development)
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

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${(err as Error).message}\n`);
  process.exitCode = 1;
});
