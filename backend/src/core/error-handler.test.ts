import { afterEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'net';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { errorHandler, notFoundHandler } from './error-handler';
import { extractAppFrame } from './error-stack.util';
import { NotFoundError, UnauthorizedError } from './errors';
import { logger } from './logger';
import { requestIdMiddleware, resolveRequestId } from './middleware/request-id.middleware';

afterEach(() => {
  mock.restoreAll();
});

function logArgs(calls: { arguments: unknown }[]): { message: string; meta: Record<string, unknown> } {
  const args = (calls[0]?.arguments ?? []) as unknown as unknown[];
  const message = typeof args[0] === 'string' ? args[0] : '';
  const meta =
    args[1] && typeof args[1] === 'object' ? (args[1] as Record<string, unknown>) : {};
  return { message, meta };
}

function createTestApp(setup?: (app: Express) => void): Express {
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  setup?.(app);
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

describe('extractAppFrame', () => {
  it('returns the first app src frame and skips node_modules', () => {
    const stack = [
      'Error: Route /sse not found',
      '    at file:///app/src/modules/customers/customers.service.ts:142:11',
      '    at Layer.handleRequest (/app/node_modules/router/lib/layer.js:152:17)',
      '    at logger (/app/node_modules/morgan/index.js:144:5)',
    ].join('\n');

    assert.equal(extractAppFrame(stack), 'src/modules/customers/customers.service.ts:142:11');
  });

  it('prefers the throw site over the error middleware frame', () => {
    const stack = [
      'NotFoundError: Customer not found',
      '    at errorHandler (/workspace/backend/src/core/error-handler.ts:40:5)',
      '    at Object.getCustomer (/workspace/backend/src/modules/customers/customers.service.ts:88:9)',
    ].join('\n');

    assert.equal(
      extractAppFrame(stack),
      'src/modules/customers/customers.service.ts:88:9'
    );
  });

  it('returns undefined when there is no stack', () => {
    assert.equal(extractAppFrame(undefined), undefined);
  });
});

describe('resolveRequestId', () => {
  it('keeps a valid incoming id and generates otherwise', () => {
    assert.equal(resolveRequestId('abc-123'), 'abc-123');
    assert.match(resolveRequestId('has spaces'), /^[0-9a-f-]{36}$/i);
    assert.match(resolveRequestId(undefined), /^[0-9a-f-]{36}$/i);
  });
});

describe('errorHandler', () => {
  it('returns a consistent envelope and request id for AppError without logging a stack', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const error = mock.method(logger, 'error', () => logger);
    const app = createTestApp((instance) => {
      instance.get('/customers/missing', () => {
        throw new NotFoundError('Customer not found');
      });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/customers/missing`, {
        headers: { 'x-request-id': 'test-req-1' },
      });
      const body = (await response.json()) as Record<string, unknown>;

      assert.equal(response.status, 404);
      assert.equal(response.headers.get('x-request-id'), 'test-req-1');
      assert.equal(body.success, false);
      assert.equal(body.error, 'Customer not found');
      assert.equal(body.code, 'NOT_FOUND');
      assert.equal(body.requestId, 'test-req-1');
      assert.equal('stack' in body, false);
    });

    assert.equal(warn.mock.callCount(), 1);
    assert.equal(error.mock.callCount(), 0);
    const { message, meta } = logArgs(warn.mock.calls);
    assert.match(message, /\[GET \/customers\/missing\] NotFoundError: Customer not found/);
    assert.equal(meta.statusCode, 404);
    assert.equal(meta.code, 'NOT_FOUND');
    assert.equal(meta.requestId, 'test-req-1');
    assert.equal('stack' in meta, false);
    assert.equal(typeof meta.at, 'string');
  });

  it('logs unhandled errors at error with stack and hides internals from the client', async () => {
    const error = mock.method(logger, 'error', () => logger);
    const app = createTestApp((instance) => {
      instance.get('/boom', () => {
        throw new Error('secret failure');
      });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/boom`);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(response.status, 500);
      assert.equal(body.error, 'Internal server error');
      assert.equal(body.code, 'INTERNAL_ERROR');
      assert.equal(typeof body.requestId, 'string');
    });

    assert.equal(error.mock.callCount(), 1);
    const { message, meta } = logArgs(error.mock.calls);
    assert.match(message, /\[GET \/boom\] Error: secret failure/);
    assert.equal(meta.statusCode, 500);
    assert.equal(typeof meta.stack, 'string');
    assert.match(String(meta.at), /error-handler\.test\.ts|\.ts:\d+:\d+/);
  });

  it('returns Zod details as a 400 VALIDATION_ERROR and logs at warn', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const app = createTestApp((instance) => {
      instance.post('/validate', (_req, _res, next) => {
        next(
          new ZodError([
            {
              code: 'invalid_type',
              expected: 'string',
              received: 'undefined',
              path: ['name'],
              message: 'Required',
            },
          ])
        );
      });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/validate`, { method: 'POST' });
      const body = (await response.json()) as {
        error: string;
        code: string;
        details: Array<{ field: string; message: string }>;
      };
      assert.equal(response.status, 400);
      assert.equal(body.code, 'VALIDATION_ERROR');
      assert.equal(body.error, 'name: Required');
      assert.deepEqual(body.details, [{ field: 'name', message: 'Required' }]);
    });

    assert.equal(warn.mock.callCount(), 1);
  });

  it('maps Prisma unique violations to 409', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const prismaError = new Error('Unique constraint failed');
    prismaError.name = 'PrismaClientKnownRequestError';
    (prismaError as Error & { code: string }).code = 'P2002';

    const app = createTestApp((instance) => {
      instance.post('/customers', (_req, _res, next) => next(prismaError));
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/customers`, { method: 'POST' });
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(response.status, 409);
      assert.equal(body.code, 'CONFLICT');
      assert.equal(body.error, 'Resource already exists');
    });

    const { meta } = logArgs(warn.mock.calls);
    assert.equal(meta.mappedFrom, 'P2002');
  });

  it('maps invalid JSON bodies to 400 INVALID_JSON', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const app = createTestApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/anything`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      });
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(response.status, 400);
      assert.equal(body.code, 'INVALID_JSON');
      assert.equal(body.error, 'Invalid JSON body');
    });

    assert.equal(warn.mock.callCount(), 1);
  });

  it('sends unknown routes through AppError as ROUTE_NOT_FOUND', async () => {
    const debug = mock.method(logger, 'debug', () => logger);
    const warn = mock.method(logger, 'warn', () => logger);
    const app = createTestApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/favicon.ico`);
      const body = (await response.json()) as Record<string, unknown>;
      assert.equal(response.status, 404);
      assert.equal(body.code, 'ROUTE_NOT_FOUND');
      assert.match(String(body.error), /GET \/favicon\.ico/);
    });

    assert.equal(debug.mock.callCount(), 1);
    assert.equal(warn.mock.callCount(), 0);
  });

  it('warns on missing API routes rather than treating them as probe noise', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const debug = mock.method(logger, 'debug', () => logger);
    const app = createTestApp();

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
      assert.equal(response.status, 404);
    });

    assert.equal(warn.mock.callCount(), 1);
    assert.equal(debug.mock.callCount(), 0);
  });

  it('does not try to send a second response when headers were already sent', async () => {
    const error = mock.method(logger, 'error', () => logger);
    const app = createTestApp((instance) => {
      instance.get('/partial', (_req: Request, res: Response, next: NextFunction) => {
        res.status(200);
        res.write('already started');
        next(new Error('late failure'));
      });
    });

    await withServer(app, async (baseUrl) => {
      try {
        const response = await fetch(`${baseUrl}/partial`);
        const text = await response.text();
        assert.match(text, /already started/);
      } catch {
        // Express may abort the socket after headers were sent; the log is the assertion.
      }
    });

    assert.equal(error.mock.callCount(), 1);
  });

  it('includes user context when the request was authenticated', async () => {
    const warn = mock.method(logger, 'warn', () => logger);
    const app = createTestApp((instance) => {
      instance.get('/secret', (req, _res) => {
        req.user = {
          userId: 'user-9',
          businessId: 'biz-2',
        } as Request['user'];
        throw new UnauthorizedError('No token provided');
      });
    });

    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/secret`);
      assert.equal(response.status, 401);
    });

    const { meta } = logArgs(warn.mock.calls);
    assert.equal(meta.userId, 'user-9');
    assert.equal(meta.businessId, 'biz-2');
  });
});
