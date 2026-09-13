import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express, { type Express } from 'express';
import cors from 'cors';
import { createRateLimiter } from '../../core/rate-limit-store';
import { errorHandler, notFoundHandler } from '../../core/error-handler';

function createAuthApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = [
          'https://somreception.com',
          'https://somreception.botandev.com',
          'https://api.somreception.botandev.com',
        ];
        if (!origin || allowed.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Business-Id', 'X-Request-Id'],
      exposedHeaders: ['Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    })
  );
  app.use(express.json());

  const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many login attempts, please try again later',
    code: 'RATE_LIMITED',
    keyGenerator: (req) => {
      const rawIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown-ip';
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase().trim() : 'anonymous';
      return `login:${rawIp}:${email}`;
    },
  });

  app.post('/api/v1/auth/login', loginLimiter, (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Validation failed', code: 'VALIDATION_ERROR' });
    }
    if (email === 'valid@somreception.com' && password === 'ValidPassword123!') {
      return res.status(200).json({
        success: true,
        data: { accessToken: 'mock-jwt-token', refreshToken: 'mock-refresh-token' },
      });
    }
    return res.status(401).json({ success: false, error: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function withServer(
  app: Express,
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

describe('CORS and OPTIONS Preflight', () => {
  it('correctly handles OPTIONS preflight for https://somreception.com', async () => {
    const app = createAuthApp();
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://somreception.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
      });

      assert.equal(res.status, 204);
      assert.equal(res.headers.get('access-control-allow-origin'), 'https://somreception.com');
      assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
      assert.match(res.headers.get('access-control-allow-methods') ?? '', /POST/);
    });
  });
});

describe('Login Rate Limiting (10 attempts / 15 minutes)', () => {
  it('allows 10 attempts and blocks the 11th with HTTP 429 and Retry-After', async () => {
    const app = createAuthApp();
    await withServer(app, async (baseUrl) => {
      const testEmail = 'attacker@test.com';

      // 10 allowed attempts
      for (let i = 1; i <= 10; i++) {
        const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '198.51.100.1',
          },
          body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' }),
        });
        assert.equal(res.status, 401, `Attempt ${i} should be 401`);
      }

      // 11th attempt must be blocked with 429
      const res11 = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.1',
        },
        body: JSON.stringify({ email: testEmail, password: 'WrongPassword!' }),
      });
      assert.equal(res11.status, 429, '11th attempt must be 429 Too Many Requests');
      assert.ok(res11.headers.get('retry-after'), 'Must include Retry-After header');

      const body = (await res11.json()) as { success: boolean; error: string; code: string };
      assert.equal(body.success, false);
      assert.equal(body.code, 'RATE_LIMITED');
      assert.equal(body.error, 'Too many login attempts, please try again later');
    });
  });

  it('valid credentials authenticate properly when not rate-limited', async () => {
    const app = createAuthApp();
    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '198.51.100.2',
        },
        body: JSON.stringify({ email: 'valid@somreception.com', password: 'ValidPassword123!' }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { success: boolean; data: { accessToken: string } };
      assert.equal(body.success, true);
      assert.ok(body.data.accessToken);
    });
  });
});
