import { describe, it, expect } from 'vitest';
import { parseEnvFile } from '../src/env-file';

function valuesOf(contents: string): Record<string, string> {
  const parsed = parseEnvFile(contents);
  return Object.fromEntries(parsed.entries.map((e) => [e.key, e.value]));
}

describe('env-file: the ordinary shapes', () => {
  it('reads a plain assignment', () => {
    expect(valuesOf('DATABASE_URL=postgres://localhost/db')).toEqual({
      DATABASE_URL: 'postgres://localhost/db',
    });
  });

  it('ignores blank lines and comments', () => {
    const parsed = parseEnvFile('# a comment\n\n   \nKEY=value\n  # indented comment\n');
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.problems).toEqual([]);
  });

  it('tolerates spaces around the equals sign', () => {
    expect(valuesOf('KEY = value')).toEqual({ KEY: 'value' });
  });

  it('accepts the export prefix', () => {
    expect(valuesOf('export KEY=value')).toEqual({ KEY: 'value' });
  });

  it('keeps an empty value and flags it', () => {
    const parsed = parseEnvFile('EMPTY=');
    expect(parsed.entries[0].value).toBe('');
    expect(parsed.warnings.map((w) => w.kind)).toContain('empty-value');
  });

  it('records the line number of each entry', () => {
    const parsed = parseEnvFile('# c\nA=1\n\nB=2\n');
    expect(parsed.entries.map((e) => [e.key, e.line])).toEqual([
      ['A', 2],
      ['B', 4],
    ]);
  });
});

describe('env-file: quoting', () => {
  it('strips double quotes and expands escapes', () => {
    expect(valuesOf('KEY="line1\\nline2"')).toEqual({ KEY: 'line1\nline2' });
    expect(valuesOf('KEY="tab\\there"')).toEqual({ KEY: 'tab\there' });
  });

  it('strips single quotes and takes the value literally', () => {
    expect(valuesOf("KEY='line1\\nline2'")).toEqual({ KEY: 'line1\\nline2' });
  });

  it('keeps an escaped quote inside a double-quoted value', () => {
    expect(valuesOf('KEY="say \\"hi\\""')).toEqual({ KEY: 'say "hi"' });
  });

  it('preserves whitespace inside quotes', () => {
    expect(valuesOf('KEY="  padded  "')).toEqual({ KEY: '  padded  ' });
  });

  it('reads a value that spans several lines, as a PEM key does', () => {
    const contents = [
      'PRIVATE_KEY="-----BEGIN KEY-----',
      'abc',
      'def',
      '-----END KEY-----"',
      'OTHER=after',
    ].join('\n');

    const values = valuesOf(contents);
    expect(values.PRIVATE_KEY).toBe('-----BEGIN KEY-----\nabc\ndef\n-----END KEY-----');
    expect(values.OTHER).toBe('after');
  });

  it('reports a quote that never closes instead of swallowing the rest of the file', () => {
    const parsed = parseEnvFile('KEY="never closed\nOTHER=value\n');
    expect(parsed.problems.map((p) => p.kind)).toEqual(['unterminated-quote']);
    expect(parsed.entries).toEqual([]);
  });
});

describe('env-file: things that must not be guessed', () => {
  it('takes an unquoted value verbatim rather than stripping a trailing comment', () => {
    // Guessing wrong here either truncates a real secret or stores a comment in
    // one, and both only fail later at runtime.
    const parsed = parseEnvFile('PASSWORD=p@ss # not a comment?');
    expect(parsed.entries[0].value).toBe('p@ss # not a comment?');
    expect(parsed.warnings.map((w) => w.kind)).toContain('possible-inline-comment');
  });

  it('does not warn when the value is quoted, since the intent is explicit', () => {
    const parsed = parseEnvFile('PASSWORD="p@ss # literal"');
    expect(parsed.entries[0].value).toBe('p@ss # literal');
    expect(parsed.warnings).toEqual([]);
  });

  it('keeps a hash that is part of the value with no space before it', () => {
    const parsed = parseEnvFile('COLOR=#ff0000');
    expect(parsed.entries[0].value).toBe('#ff0000');
    expect(parsed.warnings).toEqual([]);
  });

  it('trims trailing whitespace from an unquoted value', () => {
    expect(valuesOf('KEY=value   ')).toEqual({ KEY: 'value' });
  });

  it('reports a duplicate key rather than picking a winner', () => {
    const parsed = parseEnvFile('KEY=first\nKEY=second\n');
    expect(parsed.entries.map((e) => e.value)).toEqual(['first']);
    expect(parsed.problems[0]).toMatchObject({ kind: 'duplicate', key: 'KEY', line: 2 });
  });

  it('reports a line that is not an assignment', () => {
    const parsed = parseEnvFile('this is not valid\nKEY=value\n');
    expect(parsed.problems[0]).toMatchObject({ kind: 'malformed', line: 1 });
    expect(parsed.entries).toHaveLength(1);
  });

  it('handles CRLF line endings', () => {
    expect(valuesOf('A=1\r\nB=2\r\n')).toEqual({ A: '1', B: '2' });
  });

  it('does not treat = inside a value as a separator', () => {
    expect(valuesOf('TOKEN=abc=def==')).toEqual({ TOKEN: 'abc=def==' });
  });

  it('returns nothing for an empty file', () => {
    const parsed = parseEnvFile('');
    expect(parsed.entries).toEqual([]);
    expect(parsed.problems).toEqual([]);
  });
});
