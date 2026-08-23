import { spawn } from 'node:child_process';
import { loadIdentity } from '../identity/index.js';
import { getSecrets } from '../vault/index.js';

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const [command, ...commandArgs] = args;
  if (!command) {
    throw new Error('Usage: fermer run <command> [args...]');
  }

  const identity = loadIdentity();
  const secrets = getSecrets(opts.env, identity);

  const exitCode = await new Promise<number>((resolve, reject) => {
    // Windows resolves commands like npm through .cmd shims that spawn cannot
    // exec directly; without a shell, "fermer run npm start" fails with ENOENT.
    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: { ...process.env, ...secrets },
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });

  process.exitCode = exitCode;
}
