import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import { createLoginRateLimiters, LOGIN_RATE_LIMIT_MAX } from './rate-limit-store';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/api/v1/auth/login', ...createLoginRateLimiters(), (_req, res) => {
    res.status(401).json({ success: false, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
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

describe('login rate limiter', () => {
  it('allows 10 attempts then returns 429 with RATE_LIMITED and Retry-After', async () => {
    await withServer(async (baseUrl) => {
      const body = JSON.stringify({ email: 'attacker@example.com', password: 'wrong' });
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i += 1) {
        const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: 'https://somreception.com' },
          body,
        });
        assert.equal(response.status, 401, `attempt ${i + 1} should be allowed`);
      }

      const blocked = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://somreception.com' },
        body,
      });
      const payload = (await blocked.json()) as { code?: string; message?: string; success?: boolean };
      assert.equal(blocked.status, 429);
      assert.equal(payload.success, false);
      assert.equal(payload.code, 'RATE_LIMITED');
      assert.match(String(payload.message), /too many login attempts/i);
      assert.ok(blocked.headers.get('retry-after'));
    });
  });
});
