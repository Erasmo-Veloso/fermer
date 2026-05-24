import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { AddressInfo } from 'node:net';

process.env.JWT_ACCESS_SECRET = 'auth-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'auth-test-refresh-secret';
process.env.JWT_ACCESS_TTL = '15m';
process.env.JWT_REFRESH_TTL = '7d';

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string | null;
  createdAt: Date;
  lastLoginAt: Date | null;
};

const state = {
  users: [] as UserRow[],
  sessions: new Map<string, { userId: string; revokedAt: Date | null }>(),
};

vi.mock('../../src/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(async () => state.users[0] ?? undefined),
      },
    },
    insert: vi.fn((_table: unknown) => ({
      values: (values: Partial<UserRow> & { email?: string; passwordHash?: string | null }) => ({
        returning: async () => {
          const user: UserRow = {
            id: `user-${state.users.length + 1}`,
            email: String(values.email),
            passwordHash: values.passwordHash ?? null,
            displayName: values.displayName ?? null,
            createdAt: new Date('2026-05-24T00:00:00.000Z'),
            lastLoginAt: null,
          };
          state.users = [user];
          return [user];
        },
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Partial<UserRow>) => ({
        where: () => ({
          returning: async () => {
            const user = state.users[0];
            if (!user) return [];
            Object.assign(user, values);
            return [user];
          },
        }),
      }),
    })),
  },
}));

vi.mock('../../src/auth/sessions', () => ({
  createSession: vi.fn(async (userId: string, refreshToken: string) => {
    state.sessions.set(refreshToken, { userId, revokedAt: null });
  }),
  findActiveSession: vi.fn(async (refreshToken: string) => {
    const session = state.sessions.get(refreshToken);
    if (!session || session.revokedAt) return null;
    return {
      userId: session.userId,
    };
  }),
  revokeSession: vi.fn(async (refreshToken: string) => {
    const session = state.sessions.get(refreshToken);
    if (session) session.revokedAt = new Date();
  }),
}));

const appModule = await import('../../src/app');

async function startServer() {
  const app = appModule.createApp();
  return await new Promise<{ baseUrl: string; close: () => Promise<void> }>((resolveServer) => {
    const server = app.listen(0, () => {
      const address = server.address() as AddressInfo;
      resolveServer({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((resolveClose) => {
            server.close(() => resolveClose());
          }),
      });
    });
  });
}

beforeEach(() => {
  state.users = [];
  state.sessions.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('auth integration', () => {
  it('registers a user and resolves /auth/me with the issued access token', async () => {
    const server = await startServer();
    try {
      const response = await fetch(`${server.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'auth@example.com',
          password: 'SenhaForte123!',
          displayName: 'Auth User',
        }),
      });

      expect(response.status).toBe(201);
      const payload = await response.json();
      expect(payload.user.email).toBe('auth@example.com');

      const meResponse = await fetch(`${server.baseUrl}/api/auth/me`, {
        headers: {
          authorization: `Bearer ${payload.tokens.accessToken}`,
        },
      });

      expect(meResponse.status).toBe(200);
      const mePayload = await meResponse.json();
      expect(mePayload.user.email).toBe('auth@example.com');
    } finally {
      await server.close();
    }
  });

  it('logs in and revokes the refresh token on logout', async () => {
    const server = await startServer();
    try {
      await fetch(`${server.baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'logout@example.com',
          password: 'SenhaForte123!',
          displayName: 'Logout User',
        }),
      });

      const loginResponse = await fetch(`${server.baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'logout@example.com',
          password: 'SenhaForte123!',
        }),
      });

      expect(loginResponse.status).toBe(200);
      const loginPayload = await loginResponse.json();

      const logoutResponse = await fetch(`${server.baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: loginPayload.tokens.refreshToken }),
      });

      expect(logoutResponse.status).toBe(204);
    } finally {
      await server.close();
    }
  });
});
