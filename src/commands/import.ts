import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative } from 'node:path';
import { loadIdentity } from '../identity/index.js';
import { isValidSecretName, listSecrets, setSecrets } from '../vault/index.js';
import { findRepoRoot } from '../vault/format.js';
import { parseEnvFile } from '../env-file.js';

const DEFAULT_FILE = '.env';

function isIgnoredByGit(filePath: string): boolean {
  const gitignorePath = join(findRepoRoot(), '.gitignore');
  if (!existsSync(gitignorePath)) {
    return false;
  }
  const name = basename(filePath);
  return readFileSync(gitignorePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === name || line === `/${name}` || line === `${name}*`);
}

export async function execute(args: string[], opts: { env: string }): Promise<void> {
  const dryRun = args.includes('--dry-run');
  const overwrite = args.includes('--overwrite');
  const filePath = args.find((arg) => !arg.startsWith('--')) ?? DEFAULT_FILE;

  if (!existsSync(filePath)) {
    throw new Error(
      `No file at ${filePath}. Pass a path, or run this where your ${DEFAULT_FILE} lives.`,
    );
  }
  if (statSync(filePath).isDirectory()) {
    throw new Error(`${filePath} is a directory, not an env file.`);
  }

  const parsed = parseEnvFile(readFileSync(filePath, 'utf8'));

  // Anything that cannot be imported cleanly aborts the whole run, and every
  // reason is reported at once so the file can be fixed in one pass. A partial
  // import would leave the caller unsure which values are live.
  const invalidNames = parsed.entries.filter((entry) => !isValidSecretName(entry.key));
  if (parsed.problems.length > 0 || invalidNames.length > 0) {
    const lines: string[] = [`Cannot import ${filePath}:`, ''];

    const malformed = parsed.problems.filter((p) => p.kind === 'malformed');
    if (malformed.length > 0) {
      lines.push('  lines that are not KEY=VALUE:');
      for (const p of malformed) lines.push(`    line ${p.line}: ${p.detail}`);
    }

    const duplicates = parsed.problems.filter((p) => p.kind === 'duplicate');
    if (duplicates.length > 0) {
      lines.push('  keys assigned more than once (which one wins is ambiguous):');
      for (const p of duplicates) lines.push(`    ${p.key} on line ${p.line}, ${p.detail}`);
    }

    const unterminated = parsed.problems.filter((p) => p.kind === 'unterminated-quote');
    if (unterminated.length > 0) {
      lines.push('  values with an unclosed quote:');
      for (const p of unterminated) lines.push(`    ${p.key} on line ${p.line}: ${p.detail}`);
    }

    if (invalidNames.length > 0) {
      lines.push('  names fermer cannot store (letters, digits, and underscores only,');
      lines.push('  not starting with a digit):');
      for (const entry of invalidNames) lines.push(`    ${entry.key} on line ${entry.line}`);
    }

    lines.push('', 'Nothing was imported.');
    throw new Error(lines.join('\n'));
  }

  if (parsed.entries.length === 0) {
    process.stdout.write(`${filePath} defines no variables. Nothing to import.\n`);
    return;
  }

  const identity = loadIdentity();
  const existing = new Set(listSecrets(opts.env, identity));

  const toWrite: Record<string, string> = {};
  const skipped: string[] = [];
  const replaced: string[] = [];

  for (const entry of parsed.entries) {
    if (existing.has(entry.key)) {
      if (!overwrite) {
        skipped.push(entry.key);
        continue;
      }
      replaced.push(entry.key);
    }
    toWrite[entry.key] = entry.value;
  }

  const names = Object.keys(toWrite).sort();

  const tally = (label: string, count: number, suffix = ''): string =>
    `  ${label.padEnd(13)}${String(count).padStart(3)}${suffix}\n`;

  process.stdout.write(`Read ${parsed.entries.length} variable(s) from ${filePath}\n\n`);
  process.stdout.write(tally(dryRun ? 'would import' : 'imported', names.length));
  if (skipped.length > 0) {
    process.stdout.write(tally('skipped', skipped.length, `  (already in ${opts.env})`));
  }
  if (replaced.length > 0) {
    process.stdout.write(tally('overwritten', replaced.length));
  }
  process.stdout.write('\n');

  if (names.length > 0) {
    process.stdout.write(`Into ${opts.env}: ${names.join(', ')}\n`);
  }
  if (skipped.length > 0) {
    process.stdout.write(`Left untouched: ${skipped.sort().join(', ')}\n`);
    process.stdout.write('Use --overwrite to replace them with the file\'s values.\n');
  }

  // Values are never echoed, so a warning can only name the key.
  const ambiguous = parsed.warnings.filter((w) => w.kind === 'possible-inline-comment');
  if (ambiguous.length > 0) {
    process.stdout.write('\nThese values contain " #" and were imported verbatim, comment and all\n');
    process.stdout.write('if that is what it was. Quote the value in the file and re-import if wrong:\n');
    for (const warning of ambiguous) {
      process.stdout.write(`  ${warning.key} (line ${warning.line})\n`);
    }
  }

  const empty = parsed.warnings.filter((w) => w.kind === 'empty-value');
  if (empty.length > 0) {
    process.stdout.write(`\nImported with an empty value: ${empty.map((w) => w.key).join(', ')}\n`);
  }

  if (dryRun) {
    process.stdout.write('\nDry run: nothing was written.\n');
    return;
  }

  if (names.length > 0) {
    setSecrets(toWrite, opts.env, identity);
  }

  const relativePath = isAbsolute(filePath) ? relative(findRepoRoot(), filePath) : filePath;
  process.stdout.write(`\n${relativePath} still holds these values in plaintext.\n`);
  if (!isIgnoredByGit(filePath)) {
    process.stdout.write(`Add ${basename(filePath)} to .gitignore before committing anything.\n`);
  }
  process.stdout.write(`Once "fermer run" works, you can delete ${relativePath}.\n`);
}
