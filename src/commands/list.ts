import { loadIdentity } from '../identity/index.js';
import { listSecrets } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const keys = listSecrets(opts.env, identity).sort();

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(keys, null, 2)}\n`);
    return;
  }

  if (keys.length === 0) {
    process.stdout.write(`No secrets in ${opts.env}.\n`);
    return;
  }

  for (const key of keys) {
    process.stdout.write(`${key}\n`);
  }
}
