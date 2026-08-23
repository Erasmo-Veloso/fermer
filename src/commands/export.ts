import { loadIdentity } from '../identity/index.js';
import { getSecrets } from '../vault/index.js';

// A value may legitimately contain newlines (a PEM key in an env var is the
// common case). Emitted bare, everything after the newline reads as a further
// KEY=VALUE line, so a value can smuggle extra variables into whatever consumes
// the output. Values that cannot survive a bare line are emitted double-quoted
// with escapes, the form dotenv and compatible parsers read back.
export function formatValue(value: string): string {
  if (!/[\n\r"\\]/.test(value) && value === value.trim()) {
    return value;
  }
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const identity = loadIdentity();
  const secrets = getSecrets(opts.env, identity);
  const keys = Object.keys(secrets).sort();

  if (args.includes('--json')) {
    // JSON.stringify escapes every value correctly on its own, so the
    // line-oriented quoting below does not apply here.
    const ordered = Object.fromEntries(keys.map((key) => [key, secrets[key]]));
    process.stdout.write(`${JSON.stringify(ordered, null, 2)}\n`);
    return;
  }

  for (const key of keys) {
    process.stdout.write(`${key}=${formatValue(secrets[key])}\n`);
  }
}
