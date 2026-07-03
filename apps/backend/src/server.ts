import { createApp } from './app';
import { config, validateProductionConfig } from './config';
import { connectDatabase, disconnectDatabase } from './infrastructure/database/prisma';
import { logger } from './core/logger';
import { historicalBackfillService } from './modules/ai-analytics/historical-backfill.service';
import { appointmentWorkflowBuilderService } from './modules/appointment-automation/workflow-builder.service';
import { featureRegistryService } from './modules/feature-management/feature-registry.service';
import { wsGateway } from './infrastructure/realtime/ws-gateway.service';

async function startServer(): Promise<void> {
  validateProductionConfig();
  await connectDatabase();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port} in ${config.env} mode`);
    // Attach the realtime WebSocket gateway to the same HTTP server so it
    // shares the port and lifecycle. Vercel serverless won't hold sockets;
    // this runs on a long-lived Node host (Railway/Render/Fly), alongside
    // the BullMQ worker.
    wsGateway.attach(server);
    logger.info('Realtime WebSocket gateway attached at /api/v1/realtime');
    void historicalBackfillService.backfillAll().catch((error) => {
      logger.warn('AI analytics historical backfill failed on startup', { error });
    });
    void appointmentWorkflowBuilderService.seedGlobalTemplates().catch((error) => {
      logger.warn('Appointment workflow template seed failed on startup', { error });
    });
    void featureRegistryService.seedRegistry().catch((error) => {
      logger.warn('Platform feature registry seed failed on startup', { error });
    });
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    wsGateway.detach();
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
