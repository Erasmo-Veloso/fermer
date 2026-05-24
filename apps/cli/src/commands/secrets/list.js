const { loadTokens } = require('../../storage/index.js');
const { getApiBaseUrl } = require('../../auth.js');

async function listSecrets({ projectId, environmentId }) {
  const tokens = loadTokens();
  const baseUrl = tokens?.apiUrl || getApiBaseUrl();
  if (!tokens?.accessToken) throw new Error('Not authenticated. Run `fermer login`.');
  if (!projectId) throw new Error('No projectId configured. Run `fermer link <projectId>`');
  if (!environmentId) throw new Error('Usage: fermer secrets list <environmentId>');

  const url = `${baseUrl}/api/secrets?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(
    environmentId,
  )}`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message = payload?.error || payload?.message || 'Failed to list secrets';
    throw new Error(message);
  }

  return payload?.secrets || [];
}

module.exports = { listSecrets };
