import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import { createLoginRateLimiters, LOGIN_RATE_LIMIT_MAX } from './rate-limit-store';

async function withServer(
  app: express.Express,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
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

function createLoginApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/api/v1/auth/login', ...createLoginRateLimiters(), (_req, res) => {
    res.status(401).json({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
  });
  return app;
}

describe('login rate limiter', () => {
  it('allows 10 attempts and rejects the 11th with 429 and Retry-After', async () => {
    const app = createLoginApp();
    await withServer(app, async (baseUrl) => {
      const url = `${baseUrl}/api/v1/auth/login`;
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
          body: JSON.stringify({ email: 'attacker@example.com', password: 'wrong' }),
        });
        assert.equal(response.status, 401, `attempt ${i + 1} should be 401`);
      }

      const limited = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ email: 'attacker@example.com', password: 'wrong' }),
      });
      assert.equal(limited.status, 429);
      assert.ok(limited.headers.get('retry-after'));
      const body = (await limited.json()) as { success: boolean; code: string; message: string };
      assert.equal(body.success, false);
      assert.equal(body.code, 'RATE_LIMITED');
      assert.match(body.message, /try again later/i);
    });
  });

  it('does not allow bypassing the email limit by rotating IPs', async () => {
    const app = createLoginApp();
    await withServer(app, async (baseUrl) => {
      const url = `${baseUrl}/api/v1/auth/login`;
      for (let i = 0; i < LOGIN_RATE_LIMIT_MAX; i++) {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': `203.0.113.${20 + i}`,
          },
          body: JSON.stringify({ email: 'shared-target@example.com', password: 'wrong' }),
        });
        assert.equal(response.status, 401);
      }

      const limited = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '198.51.100.9',
        },
        body: JSON.stringify({ email: 'shared-target@example.com', password: 'wrong' }),
      });
      assert.equal(limited.status, 429);
    });
  });

  it('does not rate-limit OPTIONS preflight', async () => {
    const app = createLoginApp();
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, { method: 'OPTIONS' });
      assert.notEqual(response.status, 429);
    });
  });
});
