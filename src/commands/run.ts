import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, extname, isAbsolute, join } from 'node:path';
import { loadIdentity } from '../identity/index.js';
import { getSecrets } from '../vault/index.js';

const CMD_SHIM_EXTENSIONS = new Set(['.cmd', '.bat']);

export interface SpawnPlan {
  file: string;
  args: string[];
  verbatim: boolean;
}

function resolveOnWindows(command: string): string | undefined {
  const extensions = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean);
  const candidates = extname(command) ? [command] : extensions.map((ext) => command + ext);

  if (isAbsolute(command) || command.includes('/') || command.includes('\\')) {
    return candidates.find(existsSync);
  }

  for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const hit = candidates.map((candidate) => join(dir, candidate)).find(existsSync);
    if (hit) return hit;
  }
  return undefined;
}

// cmd.exe re-parses the command line it is handed, so anything passed through it
// must be escaped twice: \" so the target program's own parser sees literal
// quotes, and ^ so cmd itself does not treat a metacharacter as syntax. Skipping
// the ^ pass lets an argument containing & or | run as a separate command, with
// the decrypted secrets already present in the environment.
function escapeCommandForCmd(command: string): string {
  return command.replace(/[()%!^<>&|;," ]/g, '^$&');
}

function escapeArgumentForCmd(argument: string): string {
  const quoted = `"${argument.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\*)$/, '$1$1')}"`;
  return quoted.replace(/[()%!^<>&|;,]/g, '^$&');
}

// Only .cmd/.bat shims need cmd.exe: Node refuses to exec them directly
// (EINVAL) and cannot find them by bare name (ENOENT). Everything else is
// spawned straight, which keeps argv byte-for-byte identical to invoking the
// command without fermer.
export function buildSpawnPlan(command: string, args: string[]): SpawnPlan {
  if (process.platform !== 'win32') {
    return { file: command, args, verbatim: false };
  }

  const resolved = resolveOnWindows(command);
  if (resolved === undefined || !CMD_SHIM_EXTENSIONS.has(extname(resolved).toLowerCase())) {
    return { file: resolved ?? command, args, verbatim: false };
  }

  const commandLine = [escapeCommandForCmd(resolved), ...args.map(escapeArgumentForCmd)].join(' ');
  return {
    file: process.env.COMSPEC ?? 'cmd.exe',
    args: ['/d', '/s', '/c', `"${commandLine}"`],
    verbatim: true,
  };
}

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const [command, ...commandArgs] = args;
  if (!command) {
    throw new Error('Usage: fermer run <command> [args...]');
  }

  const identity = loadIdentity();
  const secrets = getSecrets(opts.env, identity);
  const plan = buildSpawnPlan(command, commandArgs);

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn(plan.file, plan.args, {
      stdio: 'inherit',
      env: { ...process.env, ...secrets },
      windowsVerbatimArguments: plan.verbatim,
    });
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      // A process killed by a signal reports code null; shells surface that as
      // 128 + signal number, so the caller can tell it apart from a clean exit.
      if (code !== null) return resolve(code);
      resolve(signal ? 128 : 1);
    });
  });

  process.exitCode = exitCode;
}
