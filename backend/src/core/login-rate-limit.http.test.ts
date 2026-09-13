import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import {
  loginRateLimitMiddleware,
  LOGIN_RATE_LIMIT_MAX,
  resetLoginRateLimitForTests,
} from './login-rate-limit';

afterEach(() => {
  resetLoginRateLimitForTests();
});

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.post('/api/v1/auth/login', loginRateLimitMiddleware, (_req, res) => {
    res.status(401).json({
      success: false,
      error: 'Invalid email or password',
      message: 'Invalid email or password',
      code: 'INVALID_CREDENTIALS',
    });
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('login rate-limit middleware', () => {
  it('returns 429 with RATE_LIMITED and Retry-After on the 11th attempt', async () => {
    await withServer(async (baseUrl) => {
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'brute@example.com', password: 'x' }),
        });
        assert.equal(response.status, 401);
      }
      const blocked = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'brute@example.com', password: 'x' }),
      });
      const body = (await blocked.json()) as Record<string, unknown>;
      assert.equal(blocked.status, 429);
      assert.equal(body.code, 'RATE_LIMITED');
      assert.equal(body.success, false);
      assert.match(String(body.message), /Too many login attempts/);
      assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    });
  });
});
