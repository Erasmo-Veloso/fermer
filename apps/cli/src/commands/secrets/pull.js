const fs = require('node:fs');
const path = require('node:path');
const { loadTokens } = require('../../storage/index.js');
const { getApiBaseUrl } = require('../../auth.js');

function getRepoRoot() {
  return process.cwd();
}

function ensureSecretsDir() {
  const dir = path.join(getRepoRoot(), '.fermer', 'secrets');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function pullSecrets({ projectId, environmentId }) {
  const tokens = loadTokens();
  const baseUrl = tokens?.apiUrl || getApiBaseUrl();
  if (!tokens?.accessToken) throw new Error('Not authenticated. Run `fermer login`.');
  if (!projectId) throw new Error('No projectId configured. Run `fermer link <projectId>`');
  if (!environmentId) throw new Error('Usage: fermer secrets pull <environmentId>');

  // List
  const listUrl = `${baseUrl}/api/secrets?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(
    environmentId,
  )}`;
  const listRes = await fetch(listUrl, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  const listPayload = await listRes.json().catch(() => null);
  if (!listRes.ok) throw new Error(listPayload?.message || 'Failed to list secrets');

  const secrets = [];
  for (const s of listPayload.secrets || []) {
    const getUrl = `${baseUrl}/api/secrets/${encodeURIComponent(s.id)}`;
    const getRes = await fetch(getUrl, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
    const getPayload = await getRes.json().catch(() => null);
    if (!getRes.ok) throw new Error(getPayload?.message || `Failed to fetch secret ${s.id}`);
    secrets.push({ id: getPayload.secret.id, name: getPayload.secret.name, version: getPayload.secret.version, encryptedValue: getPayload.secret.encryptedValue });
  }

  const dir = ensureSecretsDir();
  const outPath = path.join(dir, `${environmentId}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ projectId, environmentId, secrets }, null, 2), 'utf8');
  return { path: outPath, count: secrets.length };
}

module.exports = { pullSecrets };
