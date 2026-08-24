import { loadIdentity } from '../identity/index.js';
import { getDefaultEnvironment, listEnvironments, setDefaultEnvironment } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const target = args.find((arg) => !arg.startsWith('--'));

  if (target !== undefined) {
    const identity = loadIdentity();
    const changed = setDefaultEnvironment(target, identity);
    process.stdout.write(
      changed
        ? `Default environment is now ${target}. Commit .fermer/config.json to share it.\n`
        : `Default environment is already ${target}.\n`,
    );
    return;
  }

  const environments = listEnvironments();
  const configured = getDefaultEnvironment();

  if (args.includes('--json')) {
    process.stdout.write(
      `${JSON.stringify({ environments, default: configured, current: opts.env }, null, 2)}\n`,
    );
    return;
  }

  for (const name of environments) {
    const notes = [name === configured ? 'default' : undefined, name === opts.env ? 'in use' : undefined]
      .filter(Boolean)
      .join(', ');
    process.stdout.write(`${name}${notes ? `  (${notes})` : ''}\n`);
  }
  process.stdout.write('\nChange the default with "fermer env <name>", or target one command\n');
  process.stdout.write('with -e, as in "fermer run -e production npm start".\n');
}
