import { createInterface } from 'node:readline/promises';
import { loadIdentity } from '../identity/index.js';
import { revokeMember } from '../vault/index.js';

export async function execute(args: string[], _opts: { env: string }): Promise<void> {
  const fingerprint = args[0];
  if (!fingerprint) {
    throw new Error('Usage: fermer revoke <fingerprint>');
  }

  const identity = loadIdentity();

  if (fingerprint === identity.fingerprint) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('This revokes your own access to this project. Continue? (y/N) ');
    rl.close();
    if (answer.trim().toLowerCase() !== 'y') {
      process.stdout.write('Aborted.\n');
      return;
    }
  }

  revokeMember(fingerprint, identity);
  process.stdout.write(`Revoked ${fingerprint}. Project key rotated; all secrets re-encrypted.\n`);
}
