import { loadIdentity } from '../identity/index.js';
import { unsetSecret } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const key = args[0];
  if (!key) {
    throw new Error('Usage: fermer unset KEY');
  }

  const identity = loadIdentity();
  unsetSecret(key, opts.env, identity);
  process.stdout.write(`Removed ${key} from ${opts.env}\n`);
}
