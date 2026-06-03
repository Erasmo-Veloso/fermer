const fs = require('node:fs');
const path = require('node:path');
const { loadTokens } = require('../../storage/index.js');
const { getApiBaseUrl } = require('../../auth.js');

function getRepoRoot() {
  return process.cwd();
}

function secretsFilePath(environmentId) {
  return path.join(getRepoRoot(), '.fermer', 'secrets', `${environmentId}.json`);
}

async function syncSecrets({ projectId, environmentId }) {
  const tokens = loadTokens();
  const baseUrl = tokens?.apiUrl || getApiBaseUrl();
  if (!tokens?.accessToken) throw new Error('Not authenticated. Run `fermer login`.');
  if (!projectId) throw new Error('No projectId configured. Run `fermer link <projectId>`');
  if (!environmentId) throw new Error('Usage: fermer secrets sync <environmentId>');

  const localPath = secretsFilePath(environmentId);
  let local = { secrets: [] };
  if (fs.existsSync(localPath)) {
    try {
      local = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    } catch {
      local = { secrets: [] };
    }
  }

  const listUrl = `${baseUrl}/api/secrets?projectId=${encodeURIComponent(projectId)}&environmentId=${encodeURIComponent(
    environmentId,
  )}`;
  const listRes = await fetch(listUrl, {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });
  const listPayload = await listRes.json().catch(() => null);
  if (!listRes.ok) throw new Error(listPayload?.message || 'Failed to list secrets');

  const updated = [];
  for (const s of listPayload.secrets || []) {
    const getUrl = `${baseUrl}/api/secrets/${encodeURIComponent(s.id)}`;
    const getRes = await fetch(getUrl, {
      headers: { authorization: `Bearer ${tokens.accessToken}` },
    });
    const getPayload = await getRes.json().catch(() => null);
    if (!getRes.ok) throw new Error(getPayload?.message || `Failed to fetch secret ${s.id}`);

    const remote = {
      id: getPayload.secret.id,
      name: getPayload.secret.name,
      version: getPayload.secret.version,
      encryptedValue: getPayload.secret.encryptedValue,
    };
    const localSecret = (local.secrets || []).find(
      (x) => x.id === remote.id || x.name === remote.name,
    );
    if (!localSecret || (remote.version && localSecret.version < remote.version)) {
      updated.push(remote);
    }
  }

  if (updated.length > 0) {
    const dir = path.join(getRepoRoot(), '.fermer', 'secrets');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const outPath = localPath;
    // Merge: replace entries by id
    const merged = new Map((local.secrets || []).map((s) => [s.id || s.name, s]));
    for (const u of updated) merged.set(u.id || u.name, u);
    const out = { projectId, environmentId, secrets: Array.from(merged.values()) };
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  }

  return { updatedCount: updated.length };
}

module.exports = { syncSecrets };
