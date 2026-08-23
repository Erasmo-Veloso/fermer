import { loadIdentity } from '../identity/index.js';
import { getSecrets } from '../vault/index.js';

export async function execute(_args: string[], opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const secrets = getSecrets(opts.env, identity);

  for (const [key, value] of Object.entries(secrets)) {
    process.stdout.write(`${key}=${value}\n`);
  }
}
