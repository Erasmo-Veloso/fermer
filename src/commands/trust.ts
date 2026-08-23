import { loadIdentity } from '../identity/index.js';
import { trustMember } from '../vault/index.js';

export async function execute(args: string[], _opts: { env: string }): Promise<void> {
  const publicKeyPath = args[0];
  if (!publicKeyPath) {
    throw new Error('Usage: fermer trust <public-key-file>');
  }

  const identity = loadIdentity();
  const { fingerprint, label } = trustMember(publicKeyPath, identity);
  process.stdout.write(`Trusted ${label} (${fingerprint})\n`);
}
