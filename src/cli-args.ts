import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMMANDS = new Set([
  'identity',
  'init',
  'set',
  'unset',
  'list',
  'run',
  'export',
  'trust',
  'revoke',
  'members',
]);

export function readVersion(): string {
  const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string };
  return pkg.version;
}

// "run"'s arguments are an arbitrary external command line, which can contain
// its own -e/--env-shaped flags (e.g. "fermer run node -e 'code'"). Scanning
// the whole array there would swallow the child's flag as fermer's own, so for
// run only, -e/--env is recognized while it leads the array; the first token
// that isn't a recognized flag or its value ends fermer's own parsing and
// everything from there is passed through untouched. Every other command's
// positional arguments never look like -e/--env, so scanning the full array
// is safe and more forgiving of flag placement.
export function extractEnv(args: string[], opts: { leadingOnly: boolean }): { env: string; rest: string[] } {
  const rest: string[] = [];
  let env = 'development';
  let stillLeading = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (stillLeading && (arg === '-e' || arg === '--env')) {
      const value = args[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value.`);
      }
      env = value;
      i++;
      continue;
    }
    if (opts.leadingOnly) {
      stillLeading = false;
      rest.push(arg);
      continue;
    }
    rest.push(arg);
  }

  return { env, rest };
}
