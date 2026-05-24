const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
};

export function formatSection(title: string) {
  return `${ANSI.bold}${ANSI.cyan}${title}${ANSI.reset}`;
}

export function formatTip(message: string) {
  return `${ANSI.dim}${message}${ANSI.reset}`;
}

export function formatWarning(message: string) {
  return `${ANSI.yellow}${message}${ANSI.reset}`;
}

export function formatError(message: string) {
  return `${ANSI.red}${message}${ANSI.reset}`;
}
