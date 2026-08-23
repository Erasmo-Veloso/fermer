import { loadIdentity } from '../identity/index.js';
import { setSecret } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const input = args[0];
  const separatorIndex = input?.indexOf('=') ?? -1;
  if (!input || separatorIndex <= 0) {
    throw new Error('Usage: fermer set KEY=VALUE');
  }

  const key = input.slice(0, separatorIndex);
  const value = input.slice(separatorIndex + 1);

  const identity = loadIdentity();
  setSecret(key, value, opts.env, identity);
  process.stdout.write(`Set ${key} in ${opts.env}\n`);
}
