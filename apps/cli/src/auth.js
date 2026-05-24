const { clearTokens, loadTokens, saveTokens } = require('./storage/index.js');

function extractErrorMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload;
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  if (payload.error && typeof payload.error.message === 'string' && payload.error.message.trim()) {
    return payload.error.message;
  }
  return fallback;
}

function getApiBaseUrl(argv = process.env.FERMER_API_URL) {
  return argv || 'http://localhost:3000';
}

function normalizeBaseUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) {
    return 'http://localhost:3000';
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid API URL: ${raw}. Use a full URL like http://localhost:3000`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Invalid API URL protocol: ${url.protocol}. Use http:// or https://`);
  }

  return url.toString().replace(/\/$/, '');
}

async function login({ apiUrl, email, password }) {
  const baseUrl = normalizeBaseUrl(apiUrl || getApiBaseUrl());
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractErrorMessage(payload, 'Failed to authenticate');
    throw new Error(message);
  }

  const tokenPair = payload?.tokens;
  const user = payload?.user;
  if (!tokenPair?.accessToken || !tokenPair?.refreshToken || !user?.id) {
    throw new Error('Unexpected login response shape');
  }

  saveTokens({
    apiUrl: baseUrl,
    accessToken: tokenPair.accessToken,
    refreshToken: tokenPair.refreshToken,
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  });

  return { user, tokens: tokenPair, apiUrl: baseUrl };
}

function logout() {
  clearTokens();
}

async function whoami() {
  const tokens = loadTokens();
  if (!tokens?.accessToken) {
    throw new Error('No local session found. Run `fermer login` first.');
  }

  const baseUrl = normalizeBaseUrl(tokens.apiUrl || getApiBaseUrl());
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { authorization: `Bearer ${tokens.accessToken}` },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = extractErrorMessage(payload, 'Failed to fetch current user');
    throw new Error(message);
  }

  return { user: payload?.user, apiUrl: baseUrl };
}

module.exports = {
  getApiBaseUrl,
  login,
  logout,
  whoami,
};
