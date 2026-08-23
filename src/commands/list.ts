import { loadIdentity } from '../identity/index.js';
import { listSecrets } from '../vault/index.js';

export async function execute(_args: string[], opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const keys = listSecrets(opts.env, identity);

  if (keys.length === 0) {
    process.stdout.write(`No secrets in ${opts.env}.\n`);
    return;
  }

  for (const key of keys.sort()) {
    process.stdout.write(`${key}\n`);
  }
}
