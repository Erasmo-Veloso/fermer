import { loadIdentity } from '../identity/index.js';
import { setSecret, addEnvironment } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const createEnvironment = args.includes('--new-env');
  const input = args.find((arg) => !arg.startsWith('--') && arg.includes('='));
  const separatorIndex = input?.indexOf('=') ?? -1;
  if (!input || separatorIndex <= 0) {
    throw new Error('Usage: fermer set KEY=VALUE [-e <env>] [--new-env]');
  }

  const key = input.slice(0, separatorIndex);
  const value = input.slice(separatorIndex + 1);

  const identity = loadIdentity();
  if (createEnvironment && addEnvironment(opts.env, identity)) {
    process.stdout.write(`Added environment ${opts.env}\n`);
  }

  setSecret(key, value, opts.env, identity);
  process.stdout.write(`Set ${key} in ${opts.env}\n`);
}
