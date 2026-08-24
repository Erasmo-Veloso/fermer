export interface EnvEntry {
  key: string;
  value: string;
  line: number;
}

export type EnvProblemKind = 'malformed' | 'duplicate' | 'unterminated-quote';

export interface EnvProblem {
  kind: EnvProblemKind;
  key?: string;
  line: number;
  detail: string;
}

export type EnvWarningKind = 'possible-inline-comment' | 'empty-value';

export interface EnvWarning {
  kind: EnvWarningKind;
  key: string;
  line: number;
}

export interface ParsedEnvFile {
  entries: EnvEntry[];
  problems: EnvProblem[];
  warnings: EnvWarning[];
}

const ASSIGNMENT = /^\s*(?:export\s+)?([^=\s]+)\s*=\s*(.*)$/;

/** Index of the first quote that is not backslash-escaped, or -1. */
function closingQuoteIndex(text: string, quote: string, allowEscapes: boolean): number {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== quote) continue;
    if (!allowEscapes) return i;
    let backslashes = 0;
    for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) backslashes++;
    if (backslashes % 2 === 0) return i;
  }
  return -1;
}

// Only double-quoted values carry escapes, matching dotenv. A single-quoted
// value is taken literally, which is the only way to express a password that
// happens to contain a backslash.
function unescapeDoubleQuoted(text: string): string {
  return text.replace(/\\(.)/g, (_, char: string) => {
    switch (char) {
      case 'n':
        return '\n';
      case 'r':
        return '\r';
      case 't':
        return '\t';
      case '"':
        return '"';
      case '\\':
        return '\\';
      default:
        return `\\${char}`;
    }
  });
}

/**
 * Parses a `.env` file without interpreting anything it cannot interpret
 * unambiguously. An unquoted value is taken verbatim rather than having a
 * trailing `# ...` stripped: guessing wrong would either truncate a secret that
 * legitimately contains `#` or smuggle a comment into one, and both fail at
 * runtime in ways that are hard to trace. Such values are reported as warnings
 * so the caller can ask the user to quote them.
 */
export function parseEnvFile(contents: string): ParsedEnvFile {
  const entries: EnvEntry[] = [];
  const problems: EnvProblem[] = [];
  const warnings: EnvWarning[] = [];
  const seen = new Map<string, number>();

  const lines = contents.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const lineNumber = index + 1;
    const line = lines[index];

    if (line.trim().length === 0 || line.trim().startsWith('#')) {
      continue;
    }

    const match = ASSIGNMENT.exec(line);
    if (!match) {
      problems.push({
        kind: 'malformed',
        line: lineNumber,
        detail: 'not a blank line, a comment, or a KEY=VALUE assignment',
      });
      continue;
    }

    const key = match[1];
    const rawValue = match[2];
    let value: string;
    let quoted = false;

    const quote = rawValue.startsWith('"') ? '"' : rawValue.startsWith("'") ? "'" : undefined;

    if (quote === undefined) {
      value = rawValue.trimEnd();
    } else {
      quoted = true;
      const allowEscapes = quote === '"';
      let body = rawValue.slice(1);
      let end = closingQuoteIndex(body, quote, allowEscapes);

      // A quoted value may span lines, which is how a PEM key ends up in a .env.
      while (end === -1 && index + 1 < lines.length) {
        index++;
        body += `\n${lines[index]}`;
        end = closingQuoteIndex(body, quote, allowEscapes);
      }

      if (end === -1) {
        problems.push({
          kind: 'unterminated-quote',
          key,
          line: lineNumber,
          detail: `value opens with ${quote} but never closes`,
        });
        continue;
      }

      const inner = body.slice(0, end);
      value = allowEscapes ? unescapeDoubleQuoted(inner) : inner;
    }

    const firstSeenAt = seen.get(key);
    if (firstSeenAt !== undefined) {
      problems.push({
        kind: 'duplicate',
        key,
        line: lineNumber,
        detail: `already assigned on line ${firstSeenAt}`,
      });
      continue;
    }
    seen.set(key, lineNumber);

    if (!quoted && / #/.test(value)) {
      warnings.push({ kind: 'possible-inline-comment', key, line: lineNumber });
    }
    if (value.length === 0) {
      warnings.push({ kind: 'empty-value', key, line: lineNumber });
    }

    entries.push({ key, value, line: lineNumber });
  }

  return { entries, problems, warnings };
}
