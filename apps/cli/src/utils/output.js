const ANSI = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  cyan: '\u001b[36m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
};

function formatSection(title) {
  return `${ANSI.bold}${ANSI.cyan}${title}${ANSI.reset}`;
}

function formatTip(message) {
  return `${ANSI.dim}${message}${ANSI.reset}`;
}

function formatWarning(message) {
  return `${ANSI.yellow}${message}${ANSI.reset}`;
}

function formatError(message) {
  return `${ANSI.red}${message}${ANSI.reset}`;
}

module.exports = {
  formatSection,
  formatTip,
  formatWarning,
  formatError,
};
