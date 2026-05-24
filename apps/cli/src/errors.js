const { formatError, formatTip } = require('./utils/output.js');

function normalizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error.message === 'string' && error.message) return error.message;
  if (typeof error.error === 'string' && error.error) return error.error;
  if (error.error && typeof error.error.message === 'string' && error.error.message) {
    return error.error.message;
  }
  return String(error);
}

function getSuggestion(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid api url')) {
    return 'Use a full URL like http://localhost:3000 or pass the API URL as the last argument.';
  }

  if (normalized.includes('not authenticated') || normalized.includes('no local session found')) {
    return 'Run fermer login before retrying this command.';
  }

  if (normalized.includes('invalid or expired access token')) {
    return 'Run fermer login again to refresh the local session.';
  }

  if (normalized.includes('invalid or expired refresh token')) {
    return 'Run fermer login again and then retry the command.';
  }

  if (normalized.includes('no project linked') || normalized.includes('no projectid configured')) {
    return 'Run fermer init and then fermer link <projectId> in this repository.';
  }

  if (normalized.includes('no local secrets file found')) {
    return 'Run fermer secrets pull <environmentId> before fermer run.';
  }

  if (normalized.includes('failed to parse local secrets file')) {
    return 'Delete the corrupted .fermer/secrets file and run fermer secrets pull again.';
  }

  if (normalized.includes('unsupported encryptedvalue format')) {
    return 'Ensure the secrets file was created by fermer secrets pull or set FERMER_LOCAL_KEY for AES-GCM payloads.';
  }

  if (normalized.includes('no command specified to run')) {
    return 'Use fermer run <environmentId> -- <command> [args].';
  }

  if (normalized.includes('usage: fermer run')) {
    return 'Provide an environment id and a command, for example: fermer run development -- node app.js.';
  }

  if (normalized.includes('usage: fermer secrets')) {
    return 'Try fermer secrets list|pull|sync <environmentId>.';
  }

  if (normalized.includes('unknown command')) {
    return 'Run fermer --help to see the available commands and examples.';
  }

  return null;
}

function formatCliError(error) {
  const message = normalizeErrorMessage(error);
  const suggestion = getSuggestion(message);
  if (!suggestion) {
    return formatError(message);
  }

  return `${formatError(message)}\n${formatTip(`Hint: ${suggestion}`)}`;
}

module.exports = {
  formatCliError,
  getSuggestion,
  normalizeErrorMessage,
};
