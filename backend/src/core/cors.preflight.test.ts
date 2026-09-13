import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express from 'express';
import cors from 'cors';
import { getCorsOptions } from './cors';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(cors(getCorsOptions()));
  app.post('/api/v1/auth/login', (_req, res) => {
    res.status(401).json({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
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

describe('CORS preflight', () => {
  it('answers OPTIONS /api/v1/auth/login with 204 and the production origin', async () => {
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
      assert.match(response.headers.get('access-control-allow-methods') ?? '', /POST/);
    });
  });

  it('does not echo an unknown origin', async () => {
    await withServer(async (baseUrl) => {
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
