import { hostname, userInfo } from 'node:os';
import {
  identityExists,
  identityPath,
  loadIdentity,
  createIdentity,
  exportPublicKey,
} from '../identity/index.js';

export async function execute(args: string[], _opts: { env: string }): Promise<void> {
  const exportIndex = args.indexOf('--export');
  let outputPath: string | undefined;
  if (exportIndex !== -1) {
    outputPath = args[exportIndex + 1];
    if (!outputPath) {
      throw new Error('--export requires a file path.');
    }
  }

  // A bare positional label must not be confused with --export's own value,
  // so both the flag and its value are excluded before searching for one.
  // exportIndex is -1 when --export is absent; +1 would then wrongly exclude
  // index 0, so the exclusion only applies when --export was actually found.
  const label = args
    .filter((_, i) => exportIndex === -1 || (i !== exportIndex && i !== exportIndex + 1))
    .find((a) => !a.startsWith('-'));

  let justCreated = false;
  if (!identityExists()) {
    createIdentity(label ?? `${userInfo().username}@${hostname()}`);
    justCreated = true;
  }
  const identity = loadIdentity();

  if (outputPath) {
    exportPublicKey(outputPath);
    process.stdout.write(`Public key exported to ${outputPath}\n`);
  }

  process.stdout.write(`${justCreated ? 'Identity created.' : 'Identity:'}\n`);
  process.stdout.write(`Fingerprint: ${identity.fingerprint}\n`);
  process.stdout.write(`Label:       ${identity.label}\n`);
  process.stdout.write(`Created:     ${identity.createdAt}\n`);
  process.stdout.write(`Stored at:   ${identityPath()}\n`);
}
