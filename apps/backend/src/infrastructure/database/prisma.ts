import { PrismaClient } from '@prisma/client';
import { logger } from '../../core/logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const DEFAULT_SERVERLESS_CONNECTION_LIMIT = '3';
const DEFAULT_POOL_TIMEOUT_SECONDS = '20';

/**
 * Normalize DATABASE_URL for Supabase PgBouncer (transaction mode, port 6543)
 * and Vercel serverless concurrency.
 *
 * Root cause of P2024: forcing connection_limit=1 while a warm Vercel instance
 * handles concurrent requests (health + webhook + API) exhausts the local pool.
 */
function resolveDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const isPooler = parsed.port === '6543' || parsed.hostname.includes('.pooler.');

    if (isPooler && !parsed.searchParams.has('pgbouncer')) {
      parsed.searchParams.set('pgbouncer', 'true');
    }

    if (!parsed.searchParams.has('connection_limit')) {
      const limit =
        process.env.DATABASE_CONNECTION_LIMIT ||
        (process.env.VERCEL ? DEFAULT_SERVERLESS_CONNECTION_LIMIT : '10');
      parsed.searchParams.set('connection_limit', limit);
    }

    if (!parsed.searchParams.has('pool_timeout')) {
      const timeout = process.env.DATABASE_POOL_TIMEOUT || DEFAULT_POOL_TIMEOUT_SECONDS;
      parsed.searchParams.set('pool_timeout', timeout);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function createPrismaClient(): PrismaClient {
  const databaseUrl = resolveDatabaseUrl();

  if (process.env.VERCEL) {
    const safeUrl = databaseUrl ? new URL(databaseUrl) : null;
    console.log('[Prisma] Serverless config:', {
      pooler: safeUrl?.port === '6543' || safeUrl?.hostname.includes('.pooler.'),
      connectionLimit: safeUrl?.searchParams.get('connection_limit'),
      poolTimeout: safeUrl?.searchParams.get('pool_timeout'),
      pgbouncer: safeUrl?.searchParams.get('pgbouncer'),
    });
  }

  return new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Reuse client across warm Vercel invocations (required in production too).
globalForPrisma.prisma = prisma;

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
