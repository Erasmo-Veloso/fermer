const readline = require('node:readline/promises');

async function confirm(message, defaultValue = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const suffix = defaultValue ? ' [Y/n] ' : ' [y/N] ';
    const answer = String(await rl.question(`${message}${suffix}`))
      .trim()
      .toLowerCase();
    if (!answer) return defaultValue;
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

module.exports = { confirm };
