import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import cors from 'cors';
import { createCorsOptions, isOriginAllowed, PRODUCTION_FRONTEND_ORIGINS } from './cors';

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

describe('CORS allowlist', () => {
  it('allows the production SomReception origin', () => {
    assert.equal(isOriginAllowed('https://somreception.com'), true);
    assert.equal(isOriginAllowed('https://www.somreception.com'), true);
    assert.equal(isOriginAllowed('https://somreception.botandev.com'), true);
  });

  it('allows requests with no Origin (non-browser clients)', () => {
    assert.equal(isOriginAllowed(undefined), true);
  });

  it('rejects unknown origins', () => {
    assert.equal(isOriginAllowed('https://evil.example'), false);
  });

  it('includes required production origins', () => {
    assert.ok(PRODUCTION_FRONTEND_ORIGINS.includes('https://somreception.com'));
  });
});

describe('CORS preflight', () => {
  it('answers OPTIONS /api/v1/auth/login with 204 and Allow-Origin for somreception.com', async () => {
    const app = express();
    app.use(cors(createCorsOptions()));
    app.options('*', cors(createCorsOptions()));
    app.post('/api/v1/auth/login', (_req, res) => res.json({ ok: true }));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://somreception.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type,authorization',
        },
      });

      assert.ok(response.status >= 200 && response.status < 300);
      assert.equal(response.headers.get('access-control-allow-origin'), 'https://somreception.com');
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      const methods = response.headers.get('access-control-allow-methods') ?? '';
      assert.match(methods, /POST/);
      const headers = (response.headers.get('access-control-allow-headers') ?? '').toLowerCase();
      assert.match(headers, /content-type/);
      assert.match(headers, /authorization/);
    });
  });

  it('does not reflect unknown origins', async () => {
    const app = express();
    app.use(cors(createCorsOptions()));
    app.post('/api/v1/auth/login', (_req, res) => res.json({ ok: true }));

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example',
          'Access-Control-Request-Method': 'POST',
        },
      });

      assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://evil.example');
    });
  });
});
