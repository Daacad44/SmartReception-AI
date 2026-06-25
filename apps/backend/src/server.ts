import { createApp } from './app';
import { config, validateProductionConfig } from './config';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { logger } from './core/logger';

async function startServer(): Promise<void> {
  validateProductionConfig();
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
