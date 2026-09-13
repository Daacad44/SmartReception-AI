import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import { corsMiddleware, isAllowedOrigin, optionsFallback } from './cors';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  process.env.FRONTEND_URL = originalEnv.FRONTEND_URL;
  process.env.CORS_ALLOWED_ORIGINS = originalEnv.CORS_ALLOWED_ORIGINS;
});

async function withServer(
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const app = express();
  app.use(corsMiddleware);
  app.options('*', optionsFallback);
  app.post('/api/v1/auth/login', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });
  app.use((_req, res) => {
    res.status(404).json({ success: false, code: 'ROUTE_NOT_FOUND' });
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

describe('isAllowedOrigin', () => {
  it('allows the production SomReception origin', () => {
    assert.equal(isAllowedOrigin('https://somreception.com'), true);
    assert.equal(isAllowedOrigin('https://www.somreception.com'), true);
  });

  it('allows the legacy botandev frontend origin', () => {
    assert.equal(isAllowedOrigin('https://somreception.botandev.com'), true);
  });

  it('rejects arbitrary origins in production', () => {
    assert.equal(isAllowedOrigin('https://evil.example', 'production'), false);
  });

  it('allows localhost in development', () => {
    assert.equal(isAllowedOrigin('http://localhost:5173', 'development'), true);
  });
});

describe('CORS preflight', () => {
  it('answers OPTIONS /api/v1/auth/login with 204 and Allow-Origin for somreception.com', async () => {
    await withServer(async (baseUrl) => {
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
      const methods = response.headers.get('access-control-allow-methods') ?? '';
      assert.match(methods, /POST/);
    });
  });

  it('does not 404 OPTIONS for an unknown origin; omits Allow-Origin', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
      assert.ok(response.status === 204 || response.status === 200);
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    });
  });

  it('reflects somreception.com on POST so the actual login request is not blocked', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          Origin: 'https://somreception.com',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'a@b.com', password: 'x' }),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('access-control-allow-origin'), 'https://somreception.com');
    });
  });
});
