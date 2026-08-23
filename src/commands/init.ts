import { loadIdentity } from '../identity/index.js';
import { initVault } from '../vault/index.js';

export async function execute(_args: string[], _opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  initVault(identity);
  process.stdout.write('Fermer initialized. .fermer/ contains encrypted secrets and is safe to commit.\n\n');
  process.stdout.write('Next steps:\n');
  process.stdout.write('  fermer set KEY=VALUE       add a secret\n');
  process.stdout.write('  fermer run <command>       run a command with secrets injected\n');
  process.stdout.write('  fermer trust <key.pub>     authorize a teammate\n');
}
