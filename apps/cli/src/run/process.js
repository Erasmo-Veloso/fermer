const { spawn } = require('node:child_process');

function runProcess(command, args, envMap) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: { ...process.env, ...envMap },
      shell: true,
    });
    child.on('close', (code) => resolve(code ?? 0));
    child.on('error', () => resolve(1));
  });
}

module.exports = { runProcess };
