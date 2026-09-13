import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import cors from 'cors';
import { createCorsOptions, type CorsRuntimeConfig } from './cors';
import { createLoginRateLimiters, LOGIN_RATE_LIMIT_MAX } from './login-rate-limit';

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

describe('CORS preflight', () => {
  const runtime: CorsRuntimeConfig = {
    frontendUrl: 'https://somreception.com',
    extraOrigins: [],
    env: 'production',
  };

  it('answers OPTIONS /api/v1/auth/login with 204 and Allow-Origin', async () => {
    const app = express();
    const corsOptions = createCorsOptions(runtime);
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    app.post('/api/v1/auth/login', (_req, res) => res.json({ success: true }));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://somreception.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization',
        },
      });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), 'https://somreception.com');
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      const methods = (response.headers.get('access-control-allow-methods') ?? '').toUpperCase();
      assert.match(methods, /POST/);
      assert.match(methods, /OPTIONS/);
    });
  });

  it('does not reflect unknown origins on preflight in production', async () => {
    const app = express();
    const corsOptions = createCorsOptions(runtime);
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));
    app.post('/api/v1/auth/login', (_req, res) => res.json({ success: true }));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example',
          'Access-Control-Request-Method': 'POST',
        },
      });
      assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://evil.example');
      assert.notEqual(response.headers.get('access-control-allow-origin'), '*');
    });
  });
});

describe('login rate limiting', () => {
  it('allows 10 attempts and returns 429 with RATE_LIMITED on the 11th', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/login', ...createLoginRateLimiters({ windowMs: 60_000, max: LOGIN_RATE_LIMIT_MAX }), (_req, res) => {
      res.json({ success: true });
    });

    await withServer(app, async (baseUrl) => {
      for (let i = 0; i < 10; i += 1) {
        const response = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
          body: JSON.stringify({ email: 'user@example.com', password: 'x' }),
        });
        assert.equal(response.status, 200, `attempt ${i + 1} should be allowed`);
      }

      const blocked = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.10' },
        body: JSON.stringify({ email: 'user@example.com', password: 'x' }),
      });
      assert.equal(blocked.status, 429);
      assert.ok(blocked.headers.get('retry-after'));
      const body = (await blocked.json()) as {
        success: boolean;
        message: string;
        code: string;
      };
      assert.equal(body.success, false);
      assert.equal(body.code, 'RATE_LIMITED');
      assert.match(body.message, /too many login attempts/i);
    });
  });

  it('cannot be bypassed by changing only the email from the same IP', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/login', ...createLoginRateLimiters({ windowMs: 60_000, max: 3 }), (_req, res) => {
      res.json({ success: true });
    });

    await withServer(app, async (baseUrl) => {
      for (let i = 0; i < 3; i += 1) {
        const response = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.20' },
          body: JSON.stringify({ email: `user${i}@example.com`, password: 'x' }),
        });
        assert.equal(response.status, 200);
      }
      const blocked = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.20' },
        body: JSON.stringify({ email: 'other@example.com', password: 'x' }),
      });
      assert.equal(blocked.status, 429);
    });
  });

  it('cannot be bypassed by changing only the IP for the same email', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/login', ...createLoginRateLimiters({ windowMs: 60_000, max: 3 }), (_req, res) => {
      res.json({ success: true });
    });

    await withServer(app, async (baseUrl) => {
      for (let i = 0; i < 3; i += 1) {
        const response = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${30 + i}` },
          body: JSON.stringify({ email: 'target@example.com', password: 'x' }),
        });
        assert.equal(response.status, 200);
      }
      const blocked = await fetch(`${baseUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.99' },
        body: JSON.stringify({ email: 'target@example.com', password: 'x' }),
      });
      assert.equal(blocked.status, 429);
    });
  });

  it('allows attempts again after the window expires', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.post('/login', ...createLoginRateLimiters({ windowMs: 80, max: 2 }), (_req, res) => {
      res.json({ success: true });
    });

    await withServer(app, async (baseUrl) => {
      const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': '192.0.2.40' };
      const body = JSON.stringify({ email: 'window@example.com', password: 'x' });
      assert.equal((await fetch(`${baseUrl}/login`, { method: 'POST', headers, body })).status, 200);
      assert.equal((await fetch(`${baseUrl}/login`, { method: 'POST', headers, body })).status, 200);
      assert.equal((await fetch(`${baseUrl}/login`, { method: 'POST', headers, body })).status, 429);
      await new Promise((resolve) => setTimeout(resolve, 120));
      assert.equal((await fetch(`${baseUrl}/login`, { method: 'POST', headers, body })).status, 200);
    });
  });
});
